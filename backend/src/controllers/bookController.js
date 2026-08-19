const pool = require('../config/db');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const processImageAndSave = async (buffer) => {
    const filename = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;
    const outputPath = path.join(UPLOADS_DIR, filename);

    await sharp(buffer)
        .resize(200, 300, { fit: 'cover', position: 'center' })
        .rotate()
        .webp({ quality: 80 })
        .toFile(outputPath);

    return filename;
};

exports.createBook = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username || req.body.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    const { title, author, publication_year, category, isbn, is_self_published } = req.body;
    
    if (!title || !author || !title.trim() || !author.trim()) {
        return res.status(400).json({ error: 'Titolo e autore sono campi obbligatori' });
    }

    const isSelfPublished = String(is_self_published).toLowerCase() === 'true';

    const finalIsbn = (!isSelfPublished && isbn && isbn.trim() !== '')
        ? isbn.trim() 
        : `AP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    let parsedYear = null;
    if (publication_year !== undefined && publication_year !== null && String(publication_year).trim() !== '') {
        const y = parseInt(publication_year, 10);
        if (isNaN(y) || y <= 1400 || y > 2100) {
            return res.status(400).json({ error: 'Anno di pubblicazione non valido (deve essere compreso tra 1401 e 2100).' });
        }
        parsedYear = y;
    }

    let coverThumbFilename = null;

    try {
        if (req.file) {
            coverThumbFilename = await processImageAndSave(req.file.buffer);
        }

        const queryText = `
            INSERT INTO books (owner_id, isbn, title, author, publication_year, category, cover_thumb)
            VALUES (
                (SELECT user_id FROM users WHERE username = $1),
                $2, $3, $4, $5, $6, $7
            )
            RETURNING *;
        `;
        const values = [username, finalIsbn, title.trim(), author.trim(), parsedYear, category || 'Manuali Tecnici', coverThumbFilename];
        const { rows } = await pool.query(queryText, values);
        
        res.status(201).json(rows[0]);
    } catch (err) {
        if (coverThumbFilename) {
            fs.unlink(path.join(UPLOADS_DIR, coverThumbFilename), () => {});
        }
        res.status(500).json({ error: 'Errore durante la creazione del volume: ' + err.message });
    }
};

exports.getNearbyBooks = async (req, res) => {
    const rawLng = req.query.lng;
    const rawLat = req.query.lat;
    const rawRadius = req.query.radius || 50000;

    const lng = parseFloat(rawLng);
    const lat = parseFloat(rawLat);
    const radius = parseFloat(rawRadius);

    if (isNaN(lng) || lng < -180 || lng > 180 || isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Coordinate geografiche non valide (lng compreso tra -180 e 180, lat tra -90 e 90)' });
    }
    if (isNaN(radius) || radius <= 0 || radius > 500000) {
        return res.status(400).json({ error: 'Raggio di ricerca non valido (deve essere compreso tra 1 e 500000 metri)' });
    }

    try {
        // Query spaziale geodetica: $1 = Longitudine (X), $2 = Latitudine (Y) conformemente a OGC/GeoJSON
        const queryText = `
            WITH perturbed_nodes AS (
                SELECT 
                    u.user_id,
                    u.username,
                    ST_SetSRID(
                        ST_MakePoint(
                            ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                            ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
                        ),
                        4326
                    )::geography AS perturbed_geog
                FROM users u
            )
            SELECT 
                b.book_id, b.title, b.author, b.publication_year, b.category, b.status, b.cover_thumb, b.isbn,
                ST_X(pn.perturbed_geog::geometry) AS lng,
                ST_Y(pn.perturbed_geog::geometry) AS lat,
                ROUND(ST_Distance(pn.perturbed_geog, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric) AS distance_meters,
                pn.username AS owner
            FROM books b
            JOIN perturbed_nodes pn ON b.owner_id = pn.user_id
            WHERE b.deleted_at IS NULL
              AND ST_DWithin(
                  pn.perturbed_geog,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters ASC
            LIMIT 100;
        `;
        const { rows } = await pool.query(queryText, [lng, lat, radius]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nella query spaziale nearby: ' + err.message });
    }
};

exports.getBooksInArea = async (req, res) => {
    const rawMinLng = req.query.minLng || req.query.west;
    const rawMinLat = req.query.minLat || req.query.south;
    const rawMaxLng = req.query.maxLng || req.query.east;
    const rawMaxLat = req.query.maxLat || req.query.north;

    const minLng = parseFloat(rawMinLng);
    const minLat = parseFloat(rawMinLat);
    const maxLng = parseFloat(rawMaxLng);
    const maxLat = parseFloat(rawMaxLat);

    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
        return res.status(400).json({ error: 'Coordinate bounding box non valide o incomplete' });
    }
    if (minLng > maxLng || minLat > maxLat) {
        return res.status(400).json({ error: 'Intervallo coordinate bounding box incoerente (min > max)' });
    }

    try {
        const queryText = `
            WITH perturbed_nodes AS (
                SELECT 
                    u.user_id,
                    u.username,
                    ST_SetSRID(
                        ST_MakePoint(
                            ST_X(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lng'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0),
                            ST_Y(u.user_location::geometry) + ((('x' || substr(md5(u.user_id::text || 'armaia_salt_lat'), 1, 8))::bit(32)::bigint % 8001 - 4000)::float / 1000000.0)
                        ),
                        4326
                    )::geography AS perturbed_geog
                FROM users u
            )
            SELECT 
                b.book_id, b.title, b.author, b.publication_year, b.category, b.status, b.cover_thumb, b.isbn,
                ST_X(pn.perturbed_geog::geometry) AS lng,
                ST_Y(pn.perturbed_geog::geometry) AS lat,
                pn.username AS owner
            FROM books b
            JOIN perturbed_nodes pn ON b.owner_id = pn.user_id
            WHERE b.deleted_at IS NULL
              AND pn.perturbed_geog && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
            ORDER BY b.added_at DESC
            LIMIT 100;
        `;
        const { rows } = await pool.query(queryText, [minLng, minLat, maxLng, maxLat]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nella query area viewport: ' + err.message });
    }
};

exports.searchBooks = async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ error: 'Termine di ricerca non fornito' });

    const rawQuery = q.trim();

    const words = rawQuery
        .replace(/[^\w\s\u00C0-\u017F]/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const tsQueryString = words.length > 0 ? words.map(w => `${w}:*`).join(' & ') : '';

    try {
        const queryText = `
            SELECT 
                b.book_id, 
                b.isbn,
                b.title, 
                b.author, 
                b.publication_year, 
                b.category, 
                b.status, 
                b.cover_thumb,
                u.username AS owner
            FROM books b
            JOIN users u ON b.owner_id = u.user_id
            WHERE b.deleted_at IS NULL
              AND (
                  (coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, '')) ILIKE '%' || $1 || '%'
                  OR (
                      $2 != '' AND to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, ''))
                          @@ to_tsquery('simple', $2)
                  )
              )
            ORDER BY 
                CASE 
                    WHEN lower(b.title) = lower($1) THEN 1
                    WHEN lower(b.title) LIKE lower($1) || '%' THEN 2
                    WHEN lower(b.author) LIKE lower($1) || '%' THEN 3
                    ELSE 4
                END ASC,
                ts_rank(
                    to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.author, '') || ' ' || coalesce(b.category, '') || ' ' || coalesce(b.isbn, '')),
                    to_tsquery('simple', CASE WHEN $2 != '' THEN $2 ELSE 'empty' END)
                ) DESC,
                b.title ASC
            LIMIT 50;
        `;
        const { rows } = await pool.query(queryText, [rawQuery, tsQueryString]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca Full-Text: ' + err.message });
    }
};

exports.getUserBooks = async (req, res) => {
    const username = req.params.username || req.headers['x-mock-user'];
    if (!username) return res.status(400).json({ error: 'Username obbligatorio' });

    try {
        const queryText = `
            SELECT b.*, u.username AS owner
            FROM books b
            JOIN users u ON b.owner_id = u.user_id
            WHERE u.username = $1 AND b.deleted_at IS NULL
            ORDER BY b.added_at DESC;
        `;
        const { rows } = await pool.query(queryText, [username]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Errore nel recupero del catalogo utente: ' + err.message });
    }
};

exports.updateBook = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username || req.body.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    const rawBookId = req.params.id;
    if (!rawBookId || isNaN(parseInt(rawBookId, 10))) {
        return res.status(400).json({ error: 'Identificativo volume non valido' });
    }
    const bookId = parseInt(rawBookId, 10);

    const { title, author, publication_year, category, status } = req.body;
    if (!title || !author || !title.trim() || !author.trim()) {
        return res.status(400).json({ error: 'Titolo e autore sono campi obbligatori' });
    }

    const validStatuses = ['available', 'requested', 'loaned'];
    const resolvedStatus = status && validStatuses.includes(status) ? status : 'available';

    let parsedYear = null;
    if (publication_year !== undefined && publication_year !== null && String(publication_year).trim() !== '') {
        const y = parseInt(publication_year, 10);
        if (isNaN(y) || y <= 1400 || y > 2100) {
            return res.status(400).json({ error: 'Anno di pubblicazione non valido.' });
        }
        parsedYear = y;
    }

    let newCoverThumbFilename = null;
    if (req.file) {
        try {
            newCoverThumbFilename = await processImageAndSave(req.file.buffer);
        } catch (imgErr) {
            return res.status(422).json({ error: 'Elaborazione immagine fallita: ' + imgErr.message });
        }
    }

    try {
        let queryText;
        let queryParams;

        if (newCoverThumbFilename) {
            const oldBookRes = await pool.query(
                `SELECT cover_thumb FROM books WHERE book_id = $1 AND owner_id = (SELECT user_id FROM users WHERE username = $2) AND deleted_at IS NULL`,
                [bookId, username]
            );

            if (oldBookRes.rowCount > 0) {
                const oldCover = oldBookRes.rows[0].cover_thumb;
                if (oldCover && oldCover.startsWith('thumb_')) {
                    const filePath = path.join(UPLOADS_DIR, oldCover);
                    fs.unlink(filePath, (err) => {
                        if (err && err.code !== 'ENOENT') console.error('Errore rimozione vecchia copertina:', err);
                    });
                }
            }

            queryText = `
                UPDATE books
                SET title = $1, author = $2, publication_year = $3, category = $4, status = $5, cover_thumb = $6
                WHERE book_id = $7
                  AND owner_id = (SELECT user_id FROM users WHERE username = $8)
                  AND deleted_at IS NULL
                RETURNING *;
            `;
            queryParams = [title.trim(), author.trim(), parsedYear, category || 'Manuali Tecnici', resolvedStatus, newCoverThumbFilename, bookId, username];
        } else {
            queryText = `
                UPDATE books
                SET title = $1, author = $2, publication_year = $3, category = $4, status = $5
                WHERE book_id = $6
                  AND owner_id = (SELECT user_id FROM users WHERE username = $7)
                  AND deleted_at IS NULL
                RETURNING *;
            `;
            queryParams = [title.trim(), author.trim(), parsedYear, category || 'Manuali Tecnici', resolvedStatus, bookId, username];
        }

        const { rows, rowCount } = await pool.query(queryText, queryParams);

        if (rowCount === 0) {
            return res.status(403).json({ error: 'Azione negata: volume non trovato o non di tua proprietà' });
        }

        res.json({ message: 'Volume aggiornato con successo', book: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Errore durante l\'aggiornamento: ' + err.message });
    }
};

exports.deleteBook = async (req, res) => {
    const username = req.headers['x-mock-user'] || req.user?.username;
    if (!username) return res.status(401).json({ error: 'Identità non fornita' });

    const rawBookId = req.params.id;
    if (!rawBookId || isNaN(parseInt(rawBookId, 10))) {
        return res.status(400).json({ error: 'Identificativo volume non valido' });
    }
    const bookId = parseInt(rawBookId, 10);

    try {
        const queryText = `
            UPDATE books 
            SET deleted_at = CURRENT_TIMESTAMP 
            WHERE book_id = $1 
              AND owner_id = (SELECT user_id FROM users WHERE username = $2)
              AND status = 'available'
              AND deleted_at IS NULL
            RETURNING book_id;
        `;
        const { rowCount } = await pool.query(queryText, [bookId, username]);
        
        if (rowCount === 0) {
            return res.status(403).json({ error: 'Azione negata o volume inesistente' });
        }

        res.json({ message: 'Volume archiviato con successo' });
    } catch (err) {
        res.status(500).json({ error: 'Errore interno durante il Soft Delete: ' + err.message });
    }
};
