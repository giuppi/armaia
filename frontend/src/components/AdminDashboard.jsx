import React, { useState, useEffect } from 'react';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/stats');
                if (!res.ok) throw new Error('Risposta non valida dal server');
                const data = await res.json();
                setStats(data);
            } catch (err) {
                setError('Impossibile caricare le statistiche. Riprova più tardi.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Colori usati nel grafico a barre.
    const categoryColors = [
        '#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb'
    ];

    // Totale utile per il grafico delle categorie.
    const totalBooks = stats?.categories?.reduce((sum, c) => sum + c.count, 0) || 0;

    return (
        <section className="card-panel admin-dashboard" aria-labelledby="admin-title">
            <h2 id="admin-title">Statistiche della Speleoteca</h2>
            <p>Panoramica dei volumi condivisi e dell'attività della nostra rete — dati aggiornati in tempo reale.</p>

            {/* Stato di caricamento. */}
            {loading && (
                <p className="text-muted" style={{ fontStyle: 'italic' }} aria-live="polite">
                    Caricamento statistiche dal database...
                </p>
            )}

            {/* Stato di errore. */}
            {error && (
                <p style={{ color: 'var(--error)', fontWeight: 'bold' }} role="alert">{error}</p>
            )}

            {/* Contenuto principale visibile quando i dati sono pronti. */}
            {stats && !loading && (
                <>
                    {/* Riepilogo delle metriche. */}
                    <div className="metrics-summary-grid" aria-label="Metriche principali">
                        <div className="metric-box">
                            <span>Volumi Condivisi</span>
                            <strong aria-label={`${stats.total_books} volumi condivisi`}>{stats.total_books}</strong>
                        </div>
                        <div className="metric-box">
                            <span>Esploratori Attivi</span>
                            <strong aria-label={`${stats.total_users} esploratori attivi`}>{stats.total_users}</strong>
                        </div>
                        <div className="metric-box">
                            <span>Prestiti Conclusi</span>
                            <strong aria-label={`${stats.completed_loans} prestiti conclusi`}>{stats.completed_loans}</strong>
                        </div>
                        <div className="metric-box">
                            <span>Prestiti Attivi</span>
                            <strong aria-label={`${stats.active_loans} prestiti attivi`}>{stats.active_loans}</strong>
                        </div>
                        <div className="metric-box">
                            <span>Richieste in Attesa</span>
                            <strong aria-label={`${stats.pending_loans} richieste in attesa`}>{stats.pending_loans}</strong>
                        </div>
                    </div>

                    {/* Grafico a barre per categoria */}
                    {stats.categories && stats.categories.length > 0 && (
                        <div className="chart-wrapper" style={{ marginTop: '2rem' }} role="region" aria-labelledby="chart-title">
                            <h3 id="chart-title">I Libri per Categoria</h3>

                            <div className="bar-chart-container" role="list" aria-label="Grafico a barre della distribuzione testi">
                                {stats.categories.map((item, index) => {
                                    const percentage = totalBooks > 0
                                        ? Math.round((item.count / totalBooks) * 100)
                                        : 0;
                                    const color = categoryColors[index % categoryColors.length];

                                    return (
                                        <div key={item.category} className="chart-row" role="listitem">
                                            <div className="chart-label" aria-hidden="true">
                                                {item.category} ({item.count} {item.count === 1 ? 'testo' : 'testi'})
                                            </div>
                                            <div className="chart-bar-wrapper">
                                                <div className="chart-bar-lane">
                                                    <div
                                                        className="chart-bar-fill"
                                                        style={{ width: `${percentage}%`, backgroundColor: color }}
                                                        role="progressbar"
                                                        aria-valuenow={percentage}
                                                        aria-valuemin="0"
                                                        aria-valuemax="100"
                                                        aria-label={`${item.category}: ${percentage}% del totale con ${item.count} ${item.count === 1 ? 'testo' : 'testi'}`}
                                                    />
                                                </div>
                                                <span className="bar-percentage-out" aria-hidden="true">{percentage}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default AdminDashboard;