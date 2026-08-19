const mockAuth = (req, res, next) => {
    const rawUser = req.headers['x-mock-user'] || req.body?.username || req.query?.username;
    
    if (!rawUser || typeof rawUser !== 'string' || !rawUser.trim()) {
        return res.status(401).json({ error: 'Autenticazione richiesta: identità utente non fornita' });
    }

    const trimmedUser = rawUser.trim();

    if (!/^[a-zA-Z0-9_]{2,64}$/.test(trimmedUser)) {
        return res.status(400).json({ error: 'Formato identità utente non valido (ammessi solo caratteri alfanumerici e underscore, max 64 caratteri)' });
    }

    req.user = { username: trimmedUser };
    req.headers['x-mock-user'] = trimmedUser;
    next();
};

module.exports = mockAuth;
