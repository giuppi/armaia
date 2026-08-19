import React, { useState, useEffect, useCallback } from 'react';
import BookDetail from './BookDetail';
import { ImageIcon, BookIcon, InboxIcon } from './UiIcons';

export default function MyLibrary({ user, addToast }) {
    const [isbn, setIsbn] = useState('');
    const [isSelfPublished, setIsSelfPublished] = useState(false);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [year, setYear] = useState('');
    const [category, setCategory] = useState('Manuali Tecnici');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [books, setBooks] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editCoverFile, setEditCoverFile] = useState(null);
    const [editPreviewUrl, setEditPreviewUrl] = useState(null);
    const [selectedBook, setSelectedBook] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Gestione del cambio copertina in fase di modifica in linea
    const handleEditFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
            setEditCoverFile(file);
            setEditPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Pulizia dell'ObjectURL allocato in memoria quando il componente viene smontato
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
        };
    }, [previewUrl, editPreviewUrl]);

    // Recupera la lista dei libri posseduti dall'utente loggato
    const fetchMyBooks = useCallback(async () => {
        if (!user?.username) return;
        try {
            const res = await fetch(`/api/books/user/${encodeURIComponent(user.username)}`, {
                headers: { 'x-mock-user': user.username }
            });
            if (res.ok) {
                const data = await res.json();
                setBooks(data);
            }
        } catch (err) {
            if (addToast) addToast("Impossibile caricare l'inventario dal server.", "error");
        }
    }, [user, addToast]);

    useEffect(() => {
        fetchMyBooks();
    }, [fetchMyBooks]);

    // Invia i dati del nuovo volume in formato multipart/form-data (testo + file binario)
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!isSelfPublished && !isbn.trim()) {
            if (addToast) addToast('Inserisci un ISBN oppure seleziona "Autoproduzione".', 'error');
            return;
        }
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('isbn', isbn.trim());
        formData.append('is_self_published', String(isSelfPublished));
        formData.append('title', title);
        formData.append('author', author);
        if (year) formData.append('publication_year', year);
        formData.append('category', category);
        formData.append('username', user.username);
        if (selectedFile) formData.append('cover', selectedFile);

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'x-mock-user': user.username },
                body: formData
            });

            if (response.ok) {
                if (addToast) addToast("Libro aggiunto alla tua libreria!", "success");
                // Reset del form dopo l'aggiunta con successo
                setIsbn('');
                setTitle('');
                setAuthor('');
                setYear('');
                setIsSelfPublished(false);
                setSelectedFile(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                fetchMyBooks();
            } else {
                const err = await response.json();
                if (addToast) addToast(err.error || "Errore durante il salvataggio", "error");
            }
        } catch (err) {
            if (addToast) addToast("Il server non risponde", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancellazione logica (Soft Delete): imposta deleted_at sul database preservando lo storico dei prestiti
    const handleDelete = async (bookId) => {
        if (!window.confirm("Rimuovere definitivamente questo libro dal catalogo attivo?")) return;
        try {
            const res = await fetch(`/api/books/${bookId}`, {
                method: 'DELETE',
                headers: { 'x-mock-user': user.username }
            });

            if (res.ok) {
                if (addToast) addToast("Volume rimosso con successo dal catalogo", "success");
                setBooks(prev => prev.filter(b => b.book_id !== bookId));
            } else {
                const err = await res.json();
                if (addToast) addToast(err.error || "Errore di autorizzazione", "error");
            }
        } catch (err) {
            if (addToast) addToast("Errore di rete", "error");
        }
    };

    // Salva le modifiche in linea apportate a un libro (inclusa l'eventuale nuova copertina)
    const handleSaveEdit = async (bookId) => {
        try {
            const formData = new FormData();
            formData.append('title', editForm.title);
            formData.append('author', editForm.author);
            if (editForm.publication_year) formData.append('publication_year', editForm.publication_year);
            formData.append('category', editForm.category);
            formData.append('status', editForm.status);
            formData.append('username', user.username);
            if (editCoverFile) formData.append('cover', editCoverFile);

            const res = await fetch(`/api/books/${bookId}`, {
                method: 'PUT',
                headers: {
                    'x-mock-user': user.username
                },
                body: formData
            });

            if (res.ok) {
                if (addToast) addToast("Dati e copertina aggiornati correttamente!", "success");
                if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
                setEditingId(null);
                setEditCoverFile(null);
                setEditPreviewUrl(null);
                fetchMyBooks();
            } else {
                const err = await res.json().catch(() => ({}));
                if (addToast) addToast(err.error || "Errore nel salvataggio", "error");
            }
        } catch (err) {
            if (addToast) addToast("Errore di rete", "error");
        }
    };

    // Annulla la modalità di modifica in linea
    const handleCancelEdit = () => {
        if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
        setEditingId(null);
        setEditCoverFile(null);
        setEditPreviewUrl(null);
    };

    // Segna un libro prestato come restituito (stato torna ad 'available')
    const handleReturnBook = async (book) => {
        try {
            const payload = { ...book, status: 'available', username: user.username };
            const res = await fetch(`/api/books/${book.book_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mock-user': user.username
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                if (addToast) addToast(`Il libro "${book.title}" è di nuovo nella tua libreria!`, "success");
                fetchMyBooks();
            } else {
                if (addToast) addToast("Errore nel rientro del prestito", "error");
            }
        } catch (err) {
            if (addToast) addToast("Errore di rete", "error");
        }
    };

    // Risolve l'URI della miniatura
    const getCoverSrc = (coverThumb) => {
        if (!coverThumb) return null;
        return coverThumb.startsWith('thumb_')
            ? `/uploads/${coverThumb}`
            : `/images/${coverThumb}`;
    };

    return (
        <div className="library-layout">
            {/* Modale dettagli volume */}
            {selectedBook && (
                <BookDetail
                    book={{ ...selectedBook, owner: user?.username }}
                    onClose={() => setSelectedBook(null)}
                />
            )}

            {/* Pannello collassabile con tag semantico HTML5 <details>/<summary> */}
            <details className="card-panel card-panel--spaced" style={{ cursor: 'pointer' }}>
                <summary style={{ fontSize: '1.2rem', fontWeight: 'bold', outline: 'none' }}>
                    <h2 style={{ display: 'inline', marginLeft: '0.5rem', fontSize: '1.4rem' }}>Aggiungi un nuovo volume</h2>
                </summary>
                <div style={{ marginTop: '1rem', cursor: 'default' }}>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        Compila i campi sottostanti per aggiungere un libro al catalogo.
                    </p>

                    <form onSubmit={handleAddSubmit} className="library-form">
                        <div className="grid-form-2col" style={{ marginBottom: '1rem' }}>
                            {/* Campo ISBN con supporto a letteratura grigia */}
                            <div className="form-group">
                                <label htmlFor="book-isbn">ISBN</label>
                                <input
                                    id="book-isbn"
                                    type="text"
                                    placeholder={isSelfPublished ? 'Autoproduzione: codice generato' : 'Codice ISBN'}
                                    required={!isSelfPublished}
                                    disabled={isSelfPublished}
                                    value={isbn}
                                    onChange={(e) => setIsbn(e.target.value)}
                                />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelfPublished}
                                        onChange={(e) => {
                                            const { checked } = e.target;
                                            setIsSelfPublished(checked);
                                            if (checked) setIsbn('');
                                        }}
                                    />
                                    Autoproduzione (letteratura grigia priva di ISBN)
                                </label>
                            </div>

                            <div className="form-group">
                                <label htmlFor="book-title">Titolo *</label>
                                <input
                                    id="book-title"
                                    type="text"
                                    placeholder="Titolo esatto del volume"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="book-author">Autore *</label>
                                <input
                                    id="book-author"
                                    type="text"
                                    placeholder="Nome dell'autore"
                                    required
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="book-year">Anno di pubblicazione</label>
                                <input
                                    id="book-year"
                                    type="number"
                                    placeholder="es. 2005"
                                    min="1401"
                                    max="2100"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="book-category">Categoria</label>
                                <select
                                    id="book-category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="Manuali Tecnici">Manuali Tecnici</option>
                                    <option value="Meteorologia Ipogea">Meteorologia Ipogea</option>
                                    <option value="Narrativa e Storia">Narrativa e Storia</option>
                                    <option value="Monografie d'Abisso">Monografie d'Abisso</option>
                                    <option value="Biografie e Soccorso">Biografie e Soccorso</option>
                                </select>
                            </div>
                        </div>

                        {/* Upload copertina con anteprima visiva */}
                        <div className="form-group">
                            <label htmlFor="book-cover">Copertina (JPEG, PNG, WebP — max 5MB)</label>
                            <div className="cover-upload-area">
                                <input 
                                    id="book-cover"
                                    type="file" 
                                    accept="image/jpeg,image/png,image/webp" 
                                    onChange={handleFileChange} 
                                    aria-label="Carica copertina volume"
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="book-cover" className="cover-upload-label">
                                    {previewUrl ? (
                                        <div className="preview-box">
                                            <img src={previewUrl} alt="Anteprima copertina caricata" className="cover-preview-img" width="100" height="150" />
                                        </div>
                                    ) : (
                                        <div className="cover-upload-placeholder">
                                            <ImageIcon tight size="lg" />
                                            <span>Clicca per selezionare un'immagine</span>
                                        </div>
                                    )}
                                </label>
                                <small className="text-muted">
                                    Il server ottimizzerà la copertina in formato WebP 200×300px tramite worker thread libvips.
                                    {selectedFile && <> — <strong>{selectedFile.name}</strong> selezionato.</>}
                                </small>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-action"
                            disabled={isSubmitting}
                            style={{ marginTop: '0.5rem' }}
                        >
                            {isSubmitting ? 'Salvataggio in corso...' : 'Aggiungi alla libreria'}
                        </button>
                    </form>
                </div>
            </details>

            {/* Tabella riassuntiva dei libri catalogati */}
            <section className="card-panel">
                <h2>La mia libreria</h2>
                {books.length === 0 ? (
                    <p className="text-muted" style={{ fontStyle: 'italic' }}>
                        Non hai ancora messo a disposizione nessun libro per la comunità. Aggiungi il tuo primo volume qui sopra.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <caption className="sr-only">Lista dei libri catalogati e condivisi dal tuo profilo</caption>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ width: '70px', textAlign: 'center' }}>Cover</th>
                                    <th scope="col">Titolo</th>
                                    <th scope="col">Autore</th>
                                    <th scope="col">Anno</th>
                                    <th scope="col">Categoria</th>
                                    <th scope="col">Disponibilità</th>
                                    <th scope="col">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {books.map((book) => (
                                    <tr key={book.book_id}>
                                        <td className="td-cover">
                                            {editingId === book.book_id ? (
                                                <div className="td-cover-edit">
                                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                                        {editPreviewUrl ? (
                                                            <img
                                                                src={editPreviewUrl}
                                                                alt="Nuova anteprima"
                                                                className="book-thumb"
                                                            />
                                                        ) : getCoverSrc(book.cover_thumb) ? (
                                                            <img
                                                                src={getCoverSrc(book.cover_thumb)}
                                                                alt={`Copertina di ${book.title}`}
                                                                className="book-thumb"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <div className="book-cover-placeholder" aria-hidden="true">
                                                                <BookIcon tight style={{ verticalAlign: 'middle' }} />
                                                            </div>
                                                        )}
                                                        {editPreviewUrl && (
                                                            <span className="new-cover-badge">Nuova</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        id={`edit-cover-${book.book_id}`}
                                                        accept="image/jpeg,image/png,image/webp"
                                                        onChange={handleEditFileChange}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <label htmlFor={`edit-cover-${book.book_id}`} className="btn-change-cover" title="Carica nuova immagine">
                                                        Cambia
                                                    </label>
                                                </div>
                                            ) : (
                                                getCoverSrc(book.cover_thumb) ? (
                                                    <img
                                                        src={getCoverSrc(book.cover_thumb)}
                                                        alt={`Apri dettagli di ${book.title}`}
                                                        className="book-thumb"
                                                        onClick={() => setSelectedBook(book)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedBook(book)}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="book-cover-placeholder" aria-hidden="true">
                                                        <BookIcon tight style={{ verticalAlign: 'middle' }} />
                                                    </div>
                                                )
                                            )}
                                        </td>
                                        {editingId === book.book_id ? (
                                            <>
                                                <td><input type="text" aria-label="Modifica Titolo" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="input--inline" /></td>
                                                <td><input type="text" aria-label="Modifica Autore" value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="input--inline" /></td>
                                                <td><input type="number" aria-label="Modifica Anno" value={editForm.publication_year || ''} onChange={e => setEditForm({ ...editForm, publication_year: e.target.value })} className="input--inline" style={{ width: '80px' }} min="1401" max="2100" /></td>
                                                <td>
                                                    <select aria-label="Modifica Categoria" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="form-select--inline">
                                                        <option value="Manuali Tecnici">Manuali Tecnici</option>
                                                        <option value="Meteorologia Ipogea">Meteorologia Ipogea</option>
                                                        <option value="Narrativa e Storia">Narrativa e Storia</option>
                                                        <option value="Monografie d'Abisso">Monografie d'Abisso</option>
                                                        <option value="Biografie e Soccorso">Biografie e Soccorso</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <select aria-label="Modifica Stato" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="form-select--inline">
                                                        <option value="available">Disponibile</option>
                                                        <option value="loaned">In Prestito</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <div className="td-actions">
                                                        <button type="button" aria-label="Salva Modifiche" className="btn-action" style={{ padding: '0.4rem 0.8rem', backgroundColor: 'var(--success)' }} onClick={() => handleSaveEdit(book.book_id)}>Salva</button>
                                                        <button type="button" aria-label="Annulla Modifiche" className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handleCancelEdit}>Annulla</button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>
                                                    <strong
                                                        style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline dotted' }}
                                                        onClick={() => setSelectedBook(book)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedBook(book)}
                                                        aria-label={`Apri scheda dettaglio di ${book.title}`}
                                                    >
                                                        {book.title}
                                                    </strong>
                                                </td>
                                                <td>{book.author}</td>
                                                <td>{book.publication_year || '—'}</td>
                                                <td>{book.category}</td>
                                                <td>
                                                    <span className={`status-badge ${book.status === 'available' ? 'active' : book.status}`}>
                                                        {book.status === 'available' ? 'Disponibile' : (book.status === 'requested' ? 'Richiesto' : 'In Prestito')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="td-actions">
                                                        <button
                                                            type="button"
                                                            aria-label={`Modifica metadati di ${book.title}`}
                                                            className="btn-action"
                                                            style={{ padding: '0.4rem 0.8rem' }}
                                                            onClick={() => {
                                                                setEditingId(book.book_id);
                                                                setEditForm({ ...book });
                                                                setEditCoverFile(null);
                                                                setEditPreviewUrl(null);
                                                            }}
                                                        >
                                                            Modifica
                                                        </button>
                                                        {book.status !== 'available' && (
                                                            <button
                                                                type="button"
                                                                aria-label={`Segna ${book.title} come restituito`}
                                                                className="btn-action"
                                                                style={{ padding: '0.4rem 0.8rem', backgroundColor: 'var(--success)' }}
                                                                onClick={() => handleReturnBook(book)}
                                                            >
                                                                <InboxIcon />Segna restituito
                                                            </button>
                                                        )}
                                                        <button type="button" aria-label={`Rimuovi libro ${book.title}`} className="btn-action" style={{ padding: '0.4rem 0.8rem', backgroundColor: 'var(--error)' }} onClick={() => handleDelete(book.book_id)}>Rimuovi</button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}