const pool = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL)::int AS total_books,
                (SELECT COUNT(*) FROM users)::int AS total_users,
                (SELECT COUNT(*) FROM loans WHERE loan_status = 'completed')::int AS completed_loans,
                (SELECT COUNT(*) FROM loans WHERE loan_status = 'active')::int AS active_loans,
                (SELECT COUNT(*) FROM loans WHERE loan_status = 'pending')::int AS pending_loans;
        `;

        const categoriesQuery = `
            SELECT category, COUNT(*)::int AS count 
            FROM books 
            WHERE deleted_at IS NULL 
            GROUP BY category 
            ORDER BY count DESC;
        `;

        const [statsResult, categoriesResult] = await Promise.all([
            pool.query(statsQuery),
            pool.query(categoriesQuery)
        ]);

        res.json({
            ...statsResult.rows[0],
            categories: categoriesResult.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Errore nel calcolo delle statistiche aggregate: ' + err.message });
    }
};
