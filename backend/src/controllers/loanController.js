const pool = require('../config/db');

exports.requestLoan = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    const rawBookId = req.body.book_id;
    if (!rawBookId || isNaN(parseInt(rawBookId, 10))) {
        return res.status(400).json({ error: 'Identificativo volume (book_id) non valido o mancante' });
    }
    const book_id = parseInt(rawBookId, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const bookCheckQuery = `
            SELECT b.book_id, b.owner_id, b.status 
            FROM books b 
            WHERE b.book_id = $1 AND b.deleted_at IS NULL 
            FOR UPDATE OF b NOWAIT;
        `;
        const bookRes = await client.query(bookCheckQuery, [book_id]);

        if (bookRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Volume non trovato o disattivato dal catalogo attivo' });
        }

        const book = bookRes.rows[0];

        if (book.status !== 'available') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Risorsa non disponibile: il volume risulta già richiesto o attualmente in prestito' });
        }

        const userRes = await client.query('SELECT user_id FROM users WHERE username = $1', [username]);
        if (userRes.rowCount === 0 || !userRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Utente richiedente non censito a sistema' });
        }
        const borrowerId = userRes.rows[0].user_id;

        if (book.owner_id === borrowerId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Auto-prestito non consentito: non puoi richiedere in prestito un volume di tua proprietà' });
        }

        await client.query(`UPDATE books SET status = 'requested' WHERE book_id = $1`, [book_id]);

        const insertLoanQuery = `
            INSERT INTO loans (book_id, borrower_id, loan_status, request_date)
            VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
            RETURNING loan_id, book_id, loan_status, request_date;
        `;
        const loanRes = await client.query(insertLoanQuery, [book_id, borrowerId]);

        await client.query('COMMIT');
        res.status(201).json(loanRes.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');

        if (err.code === '55P03') {
            return res.status(409).json({
                error: 'Risorsa momentaneamente contesa da altra transazione attiva. Riprovare.'
            });
        }
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Transazione concorrente: richiesta di prestito gia registrata per questo volume.'
            });
        }
        if (err.code === '23514' || (err.message && err.message.includes('Auto-prestito'))) {
            return res.status(400).json({
                error: err.message
            });
        }

        res.status(500).json({ error: 'Errore transazionale nella gestione del prestito: ' + err.message });
    } finally {
        client.release();
    }
};

exports.getUserLoans = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username || req.query.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    try {
        const queryText = `
            SELECT 
                l.loan_id,
                l.book_id,
                b.title AS "bookTitle",
                l.loan_status AS status,
                l.request_date,
                l.start_date,
                l.end_date,
                borrower.username AS borrower,
                owner.username AS owner
            FROM loans l
            JOIN books b ON l.book_id = b.book_id
            JOIN users borrower ON l.borrower_id = borrower.user_id
            JOIN users owner ON b.owner_id = owner.user_id
            WHERE (borrower.username = $1 OR owner.username = $1)
              AND b.deleted_at IS NULL
            ORDER BY l.request_date DESC;
        `;
        const { rows } = await pool.query(queryText, [username]);
        
        const outbound = rows.filter(r => r.borrower === username);
        const incoming = rows.filter(r => r.owner === username);

        res.json({ outbound, incoming });
    } catch (err) {
        res.status(500).json({ error: 'Errore nel recupero prestiti: ' + err.message });
    }
};

exports.updateLoanStatus = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    const rawLoanId = req.params.loanId;
    if (!rawLoanId || isNaN(parseInt(rawLoanId, 10))) {
        return res.status(400).json({ error: 'Identificativo prestito non valido' });
    }
    const loanId = parseInt(rawLoanId, 10);

    const { status } = req.body;
    const validStatuses = ['pending', 'active', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Stato prestito non valido' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const loanQuery = `
            SELECT l.loan_id, l.book_id, l.borrower_id, l.loan_status, b.owner_id, 
                   borrower.username AS borrower_name, owner.username AS owner_name
            FROM loans l
            JOIN books b ON l.book_id = b.book_id
            JOIN users borrower ON l.borrower_id = borrower.user_id
            JOIN users owner ON b.owner_id = owner.user_id
            WHERE l.loan_id = $1
            FOR UPDATE OF l NOWAIT;
        `;
        const loanRes = await client.query(loanQuery, [loanId]);
        if (loanRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transazione di prestito non trovata' });
        }

        const loan = loanRes.rows[0];

        if (loan.borrower_name !== username && loan.owner_name !== username) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Non sei autorizzato a modificare questo prestito' });
        }

        let bookStatus = 'available';
        if (status === 'active') {
            bookStatus = 'loaned';
        } else if (status === 'pending') {
            bookStatus = 'requested';
        }

        await client.query('UPDATE books SET status = $1 WHERE book_id = $2', [bookStatus, loan.book_id]);
        
        let updateLoanSql = `UPDATE loans SET loan_status = $1`;
        const params = [status, loanId];
        if (status === 'active') {
            updateLoanSql += `, start_date = CURRENT_TIMESTAMP`;
        } else if (status === 'completed' || status === 'rejected') {
            updateLoanSql += `, end_date = CURRENT_TIMESTAMP`;
        }
        updateLoanSql += ` WHERE loan_id = $2 RETURNING *;`;

        const updatedLoanRes = await client.query(updateLoanSql, params);
        await client.query('COMMIT');

        res.json(updatedLoanRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '55P03') {
            return res.status(409).json({ error: 'Prestito momentaneamente bloccato da altra operazione. Riprovare.' });
        }
        res.status(500).json({ error: 'Errore nell\'aggiornamento prestito: ' + err.message });
    } finally {
        client.release();
    }
};
