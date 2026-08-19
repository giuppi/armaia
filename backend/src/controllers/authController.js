const pool = require('../config/db');

exports.register = async (req, res) => {
    const rawUsername = (req.body.username || '').trim();
    const rawEmail = (req.body.email || '').trim();

    if (!rawUsername || !rawEmail) {
        return res.status(400).json({ error: 'Username ed email sono obbligatori' });
    }

    try {
        const mockLat = 44.4056;
        const mockLng = 8.9463;

        const queryText = `
            INSERT INTO users (username, email, user_location)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
            RETURNING user_id, username, email;
        `;
        const { rows } = await pool.query(queryText, [rawUsername, rawEmail, mockLng, mockLat]);

        res.status(201).json({
            ...rows[0],
            lat: mockLat,
            lng: mockLng
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username o email già in uso' });
        }
        res.status(500).json({ error: 'Errore interno del database: ' + err.message });
    }
};

exports.login = async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username obbligatorio' });
    }

    try {
        const queryText = `
            SELECT user_id, username, email,
                   ST_Y(user_location::geometry) AS lat,
                   ST_X(user_location::geometry) AS lng
            FROM users
            WHERE username = $1
        `;
        const { rows } = await pool.query(queryText, [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Utente non censito nel sistema' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Errore durante l\'autenticazione: ' + err.message });
    }
};
