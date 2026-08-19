import React, { useState } from 'react';

const AuthForm = ({ onLoginSuccess, addToast }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');

    const demoUsers = [
        { label: 'Speleo GE (Genova)', user: 'speleo_ge' },
        { label: 'Carsico CN (Cuneo)', user: 'carsico_cn' },
        { label: 'Apuane LU (Lucca)', user: 'apuane_lu' }
    ];

    const performLogin = async (userToLogin) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: userToLogin })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Credenziali non valide");
            }

            const userData = await response.json();
            if (addToast) addToast(`Benvenuto, ${userData.username}!`, "success");
            onLoginSuccess(userData);
        } catch (error) {
            if (addToast) addToast(error.message, "error");
        }
    };

    // Gestione invio del form (distingue tra registrazione di un nuovo nodo e login)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isRegistering) {
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || "Errore durante la registrazione");
                }

                const userData = await response.json();
                if (addToast) addToast(`Registrazione completata! Benvenuto, ${userData.username}!`, "success");
                onLoginSuccess(userData);
            } catch (error) {
                if (addToast) addToast(error.message, "error");
            }
        } else {
            performLogin(username);
        }
    };

    return (
        <div className="auth-container" aria-live="polite">
            <h2>{isRegistering ? 'Unisciti all\'Armâia' : 'Accedi alla Speleoteca'}</h2>
            
            <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="es. speleo_ge"
                        aria-required="true"
                    />
                </div>

                {isRegistering && (
                    <div className="form-group">
                        <label htmlFor="email">Email Istituzionale:</label>
                        <input
                            type="email"
                            id="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="es. custode@speleo.it"
                            aria-required="true"
                        />
                    </div>
                )}

                <button type="submit" className="btn-action">
                    {isRegistering ? 'Registra Profilo' : 'Accedi'}
                </button>
            </form>

            {/* Selettori rapidi per gli utenti seed di collaudo */}
            {!isRegistering && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                        Accesso rapido nodi demo:
                    </small>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {demoUsers.map(d => (
                            <button
                                key={d.user}
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                                onClick={() => {
                                    setUsername(d.user);
                                    performLogin(d.user);
                                }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Switch tra form di login e form di registrazione */}
            <button 
                type="button" 
                className="btn-toggle" 
                onClick={() => setIsRegistering(!isRegistering)}
            >
                {isRegistering ? 'Hai già un account? Entra qui' : 'Nuovo esploratore? Registrati'}
            </button>
        </div>
    );
};

export default AuthForm;