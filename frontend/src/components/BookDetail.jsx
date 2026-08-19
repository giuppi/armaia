import React, { useEffect, useRef } from 'react';

export default function BookDetail({ book, onClose, onRequestLoan, onRequest }) {
    const closeBtnRef = useRef(null);
    const previousFocusRef = useRef(null);
    const handleRequest = onRequestLoan || onRequest;

    useEffect(() => {
        previousFocusRef.current = document.activeElement;
        closeBtnRef.current?.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocusRef.current instanceof HTMLElement) {
                previousFocusRef.current.focus();
            }
        };
    }, [onClose]);

    if (!book) return null;

    // Riconosce le autoproduzioni o letteratura grigia identificate dal prefisso AP-
    const isSelfPublished = typeof book.isbn === 'string' && book.isbn.startsWith('AP-');

    // Risolve il percorso dell'immagine: miniature caricate dall'utente (/uploads) o immagini seed statiche (/images)
    const coverSrc = book.cover_thumb
        ? (book.cover_thumb.startsWith('thumb_')
            ? `/uploads/${book.cover_thumb}`
            : `/images/${book.cover_thumb}`)
        : null;

    return (
        <div className="modal-backdrop" role="presentation" onClick={onClose}>
            {/* Contenitore modale con ruoli ARIA per screen reader */}
            <div
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    ref={closeBtnRef}
                    onClick={onClose}
                    aria-label="Chiudi finestra modale"
                    className="close-btn"
                >
                    &times;
                </button>

                <h2 id="modal-title">{book.title}</h2>

                {/* Anteprima copertina con gestione fallback anti-broken image */}
                {coverSrc && (
                    <div style={{ textAlign: 'center', margin: '0.75rem 0' }}>
                        <img
                            src={coverSrc}
                            alt={`Copertina di ${book.title}`}
                            style={{ maxHeight: '180px', objectFit: 'contain', borderRadius: '6px' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                )}

                <p><strong>Autore:</strong> {book.author}</p>
                {book.publication_year && <p><strong>Anno:</strong> {book.publication_year}</p>}
                <p><strong>Codice:</strong> {isSelfPublished ? 'Autoproduzione (' + book.isbn + ')' : (book.isbn || '—')}</p>
                <p><strong>Categoria:</strong> {book.category}</p>
                <p><strong>Custode:</strong> {book.owner || book.username}</p>

                {/* Sezione azioni: pulsante di prestito se disponibile, altrimenti badge informativo */}
                <div style={{ marginTop: '1.2rem' }}>
                    {book.status === 'available' ? (
                        handleRequest ? (
                            <button 
                                className="btn-primary" 
                                onClick={() => handleRequest(book.book_id, book.owner || book.username)}
                            >
                                Richiedi Consultazione / Prestito
                            </button>
                        ) : null
                    ) : (
                        <span className="badge-busy">Attualmente non disponibile</span>
                    )}
                </div>
            </div>
        </div>
    );
}
