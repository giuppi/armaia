import React, { useState, useEffect, useCallback } from 'react';
import { CheckIcon, MessageIcon, InboxIcon, CloseIcon } from './UiIcons';

const MOCK_SCENARIOS = {
    speleo_ge: {
        outbound: [
            { id: 201, bookTitle: 'La fenice delle grotte', owner: 'carsico_cn', status: 'idle' }
        ],
        incoming: [
            { loan_id: 101, bookTitle: 'Manuale di speleologia', borrower: 'carsico_cn', status: 'pending' }
        ]
    },
    carsico_cn: {
        outbound: [
            { id: 202, bookTitle: 'Manuale di speleologia', owner: 'speleo_ge', status: 'idle' }
        ],
        incoming: [
            { loan_id: 102, bookTitle: 'La fenice delle grotte', borrower: 'apuane_lu', status: 'pending' }
        ]
    },
    apuane_lu: {
        outbound: [
            { id: 203, bookTitle: 'Fisica del clima sotterraneo', owner: 'speleo_ge', status: 'idle' }
        ],
        incoming: [
            { loan_id: 103, bookTitle: 'Monte Corchia', borrower: 'speleo_ge', status: 'pending' }
        ]
    }
};

const LoanManager = ({ user, addToast }) => {
    const [outboundRequests, setOutboundRequests] = useState([]);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLoans = useCallback(async () => {
        if (!user?.username) return;
        try {
            setLoading(true);
            const res = await fetch('/api/loans', {
                headers: { 'x-mock-user': user.username }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.outbound?.length > 0 || data.incoming?.length > 0) {
                    setOutboundRequests(data.outbound.map(o => ({
                        id: o.loan_id,
                        bookTitle: o.bookTitle,
                        owner: o.owner,
                        status: o.status
                    })));
                    setIncomingRequests(data.incoming.map(i => ({
                        loan_id: i.loan_id,
                        bookTitle: i.bookTitle,
                        borrower: i.borrower,
                        status: i.status
                    })));
                } else {
                    const fallback = MOCK_SCENARIOS[user.username] || { outbound: [], incoming: [] };
                    setOutboundRequests(fallback.outbound);
                    setIncomingRequests(fallback.incoming);
                }
            } else {
                const fallback = MOCK_SCENARIOS[user.username] || { outbound: [], incoming: [] };
                setOutboundRequests(fallback.outbound);
                setIncomingRequests(fallback.incoming);
            }
        } catch (err) {
            const fallback = MOCK_SCENARIOS[user?.username] || { outbound: [], incoming: [] };
            setOutboundRequests(fallback.outbound);
            setIncomingRequests(fallback.incoming);
        } finally {
            setLoading(false);
        }
    }, [user?.username]);

    useEffect(() => {
        fetchLoans();
    }, [fetchLoans]);

    // Gestione azioni sulle richieste in entrata (approva, rifiuta, completa)
    const handleAction = async (loanId, newStatus) => {
        try {
            const res = await fetch(`/api/loans/${loanId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mock-user': user.username
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setIncomingRequests(prev =>
                    prev.map(req => req.loan_id === loanId ? { ...req, status: newStatus } : req)
                );
                if (newStatus === 'active') {
                    if (addToast) addToast('Prestito Convalidato! Organizza la consegna con il richiedente.', 'success');
                } else if (newStatus === 'completed') {
                    if (addToast) addToast('Prestito concluso con successo. Il volume è di nuovo disponibile.', 'success');
                } else {
                    if (addToast) addToast('Richiesta declinata. Il libro rimane nella tua libreria.', 'success');
                }
            } else {
                // Aggiornamento client-side fallback
                setIncomingRequests(prev =>
                    prev.map(req => req.loan_id === loanId ? { ...req, status: newStatus } : req)
                );
                if (addToast) addToast(`Stato aggiornato a ${newStatus}`, 'success');
            }
        } catch (err) {
            setIncomingRequests(prev =>
                prev.map(req => req.loan_id === loanId ? { ...req, status: newStatus } : req)
            );
            if (addToast) addToast(`Stato aggiornato a ${newStatus}`, 'success');
        }
    };

    // Annullamento di una richiesta in uscita inviata dall'utente attivo (prima dell'approvazione)
    const handleCancelOutbound = async (loanId) => {
        if (!window.confirm("Annullare la richiesta di prestito inviata per questo volume?")) return;
        try {
            const res = await fetch(`/api/loans/${loanId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mock-user': user.username
                },
                body: JSON.stringify({ status: 'rejected' })
            });

            if (res.ok) {
                setOutboundRequests(prev =>
                    prev.map(req => req.id === loanId ? { ...req, status: 'rejected' } : req)
                );
                if (addToast) addToast('Richiesta di prestito annullata. Il volume è tornato disponibile.', 'success');
            } else {
                setOutboundRequests(prev =>
                    prev.map(req => req.id === loanId ? { ...req, status: 'rejected' } : req)
                );
                if (addToast) addToast('Richiesta annullata.', 'success');
            }
        } catch (err) {
            setOutboundRequests(prev =>
                prev.map(req => req.id === loanId ? { ...req, status: 'rejected' } : req)
            );
            if (addToast) addToast('Richiesta annullata.', 'success');
        }
    };

    const translateStatus = (status) => {
        switch (status) {
            case 'idle': return 'Nessuna richiesta attiva';
            case 'pending': return 'In attesa di convalida';
            case 'active': return 'In corso / Consegnato';
            case 'rejected': return 'Rifiutato / Annullato';
            case 'completed': return 'Concluso';
            default: return status;
        }
    };

    const activeOutbound = outboundRequests.filter(req => ['idle', 'pending', 'active'].includes(req.status));
    const historyOutbound = outboundRequests.filter(req => ['completed', 'rejected'].includes(req.status));

    const activeIncoming = incomingRequests.filter(req => ['pending', 'active'].includes(req.status));
    const historyIncoming = incomingRequests.filter(req => ['completed', 'rejected'].includes(req.status));

    return (
        <section className="loan-layout">
            <article className="card-panel">
                <h2>I Libri che ho Richiesto</h2>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                    Tieni traccia delle richieste di consultazione e prestito inviate ai custodi dei nodi.
                </p>

                <div className="outbound-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeOutbound.length === 0 && (
                        <p className="text-muted" style={{ fontStyle: 'italic' }}>Non hai richieste in corso.</p>
                    )}
                    {activeOutbound.map(req => (
                        <div key={req.id} className="loan-outbound-card">
                            <p>
                                <strong>{req.bookTitle}</strong>
                                {' '}(Custode: <strong>{req.owner}</strong>)
                            </p>
                            <p>Stato: <strong>{translateStatus(req.status)}</strong></p>

                            {req.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="status-badge requested" style={{ flexGrow: 1, textAlign: 'center', padding: '0.45rem 0.6rem' }}>
                                        In attesa di convalida dal custode
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-action"
                                        style={{ backgroundColor: 'var(--error)', padding: '0.45rem 0.8rem' }}
                                        onClick={() => handleCancelOutbound(req.id)}
                                        aria-label={`Annulla richiesta per ${req.bookTitle}`}
                                    >
                                        <CloseIcon tight /> Annulla richiesta
                                    </button>
                                </div>
                            )}
                            {req.status === 'active' && (
                                <div style={{ marginTop: '0.8rem' }}>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                        <CheckIcon />La richiesta è stata approvata. Puoi accordarti per il ritiro.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn-action"
                                        style={{ backgroundColor: 'var(--primary)', padding: '0.4rem 0.8rem', width: '100%' }}
                                        onClick={() => addToast && addToast('Contatto con il custode abilitato', 'info')}
                                    >
                                        <MessageIcon />Contatta il custode ({req.owner})
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {historyOutbound.length > 0 && (
                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Storico Richieste</h3>
                            {historyOutbound.map(req => (
                                <div key={req.id} className="loan-outbound-card" style={{ opacity: 0.7 }}>
                                    <p><strong>{req.bookTitle}</strong> (Custode: <strong>{req.owner}</strong>)</p>
                                    <p>Stato: <strong>{translateStatus(req.status)}</strong></p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </article>

            <article className="card-panel">
                <h2>Richieste ricevute dagli altri Nodi</h2>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                    Altri esploratori hanno richiesto libri presenti nel tuo inventario. Convalida le richieste per accordarti sulla consultazione.
                </p>

                {activeIncoming.length === 0 ? (
                    <p className="text-muted" style={{ fontStyle: 'italic' }}>
                        Nessuna richiesta attiva in entrata al momento.
                    </p>
                ) : (
                    <table className="data-table">
                        <caption className="sr-only">Gestione logistica delle richieste di prestito in entrata</caption>
                        <thead>
                            <tr>
                                <th scope="col">Libro richiesto</th>
                                <th scope="col">Richiedente</th>
                                <th scope="col">Stato</th>
                                <th scope="col">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeIncoming.map((req) => (
                                <tr key={req.loan_id}>
                                    <td><strong>{req.bookTitle}</strong></td>
                                    <td>{req.borrower}</td>
                                    <td>
                                        <span className={`status-badge ${req.status}`}>
                                            {translateStatus(req.status).toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        {req.status === 'pending' && (
                                            <div className="td-actions">
                                                <button
                                                    className="btn-action"
                                                    style={{ backgroundColor: 'var(--success)' }}
                                                    aria-label={`Approva prestito per ${req.bookTitle}`}
                                                    onClick={() => handleAction(req.loan_id, 'active')}
                                                >
                                                    Approva
                                                </button>
                                                <button
                                                    className="btn-action"
                                                    style={{ backgroundColor: 'var(--error)' }}
                                                    aria-label={`Rifiuta prestito per ${req.bookTitle}`}
                                                    onClick={() => handleAction(req.loan_id, 'rejected')}
                                                >
                                                    Rifiuta
                                                </button>
                                            </div>
                                        )}
                                        {req.status === 'active' && (
                                            <div className="td-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn-action"
                                                    style={{ backgroundColor: 'var(--success)', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                                    aria-label={`Segna prestito come concluso`}
                                                    onClick={() => handleAction(req.loan_id, 'completed')}
                                                >
                                                    <InboxIcon />Segna restituito
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {historyIncoming.length > 0 && (
                    <div style={{ marginTop: '2.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Storico Prestiti</h3>
                        <table className="data-table" style={{ opacity: 0.7 }}>
                            <caption className="sr-only">Storico prestiti in entrata conclusi o rifiutati</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Libro richiesto</th>
                                    <th scope="col">Richiedente</th>
                                    <th scope="col">Esito</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyIncoming.map((req) => (
                                    <tr key={req.loan_id}>
                                        <td><strong>{req.bookTitle}</strong></td>
                                        <td>{req.borrower}</td>
                                        <td>
                                            <span className={`status-badge ${req.status}`}>
                                                {translateStatus(req.status).toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </article>
        </section>
    );
};

export default LoanManager;