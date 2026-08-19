import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BookDetail from './BookDetail';
import { SearchIcon, CloseIcon, PinIcon, MapIcon, BookIcon, RadarIcon } from './UiIcons';

// Costanti di stile per marker e anelli radar
const ACCENT_COLOR = '#f59e0b';
const MARKER_STROKE = '#ffffff';

// Correzione percorsi icone Leaflet per il bundler Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/marker-icon-2x.png',
    iconUrl: '/images/marker-icon.png',
    shadowUrl: '/images/marker-shadow.png',
});

// Icona SVG personalizzata per indicare la posizione di riferimento dell'utente loggato
const homeIcon = new L.DivIcon({
    html: '<div style="line-height:1; text-align:center; filter:drop-shadow(0px 4px 4px rgba(0,0,0,0.4));" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg></div>',
    className: 'custom-home-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

const MapInstanceBridge = ({ mapRef }) => {
    const map = useMap();

    useEffect(() => {
        mapRef.current = map;
    }, [map, mapRef]);

    return null;
};

const MapExplorer = ({ userCoordinates, addToast, user }) => {
    // Lista dei libri trovati tramite query geospaziali
    const [books, setBooks] = useState([]);
    // Raggio di ricerca in metri (default 50 km)
    const [radius, setRadius] = useState(50000);
    // Modalità geografica attiva ('radius' oppure 'area')
    const [geoMode, setGeoMode] = useState('radius');

    // Coordinate Bounding Box (Nord, Sud, Est, Ovest in WGS84)
    const [bbox, setBbox] = useState({
        north: 45.2,
        south: 43.8,
        east: 10.6,
        west: 7.2
    });
    const [appliedBbox, setAppliedBbox] = useState({
        north: 45.2,
        south: 43.8,
        east: 10.6,
        west: 7.2
    });

    // Stato per la ricerca testuale
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isGeoSearching, setIsGeoSearching] = useState(false);

    // Libro selezionato per l'apertura della modale di dettaglio
    const [selectedBook, setSelectedBook] = useState(null);
    
    // Riferimento all'istanza della mappa Leaflet
    const mapRef = useRef(null);

    // Array di coordinate per il rettangolo Leaflet
    const areaBounds = [
        [Number(appliedBbox.south), Number(appliedBbox.west)],
        [Number(appliedBbox.north), Number(appliedBbox.east)]
    ];

    // Esclude i libri posseduti dall'utente attivo (non ha senso richiedere in prestito i propri libri)
    const applyOwnershipFilter = (items) => items.filter((book) => book.owner !== user?.username);

    // Query per raggio: chiama l'endpoint /api/books/nearby
    const fetchRadiusResources = async () => {
        const response = await fetch(
            `/api/books/nearby?lng=${userCoordinates.lng}&lat=${userCoordinates.lat}&radius=${radius}`
        );
        if (!response.ok) throw new Error('Errore network nella query spaziale');
        const data = await response.json();
        setBooks(applyOwnershipFilter(data));
    };

    // Query per area: chiama l'endpoint /api/books/area con coordinate BBOX
    const fetchAreaResources = async (area = bbox) => {
        const query = new URLSearchParams({
            minLng: String(area.west),
            minLat: String(area.south),
            maxLng: String(area.east),
            maxLat: String(area.north)
        });

        const response = await fetch(`/api/books/area?${query.toString()}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Errore ricerca area');
        }
        const data = await response.json();
        setBooks(applyOwnershipFilter(data));
    };

    // Ricarica i dati per la modalità raggio quando variano raggio o coordinate profilo
    useEffect(() => {
        if (geoMode === 'radius') {
            fetchRadiusResources();
        }
    }, [userCoordinates?.lat, userCoordinates?.lng, radius, geoMode]);

    // Gestione cambio modalità tra Raggio e BBOX
    const handleSwitchMode = (newMode) => {
        setGeoMode(newMode);
        if (newMode === 'area') {
            const map = mapRef.current;
            if (map) {
                const bounds = map.getBounds();
                const north = parseFloat(bounds.getNorth().toFixed(5));
                const south = parseFloat(bounds.getSouth().toFixed(5));
                const east = parseFloat(bounds.getEast().toFixed(5));
                const west = parseFloat(bounds.getWest().toFixed(5));

                const currentBox = {
                    north: bounds.getNorth().toFixed(5),
                    south: bounds.getSouth().toFixed(5),
                    east: bounds.getEast().toFixed(5),
                    west: bounds.getWest().toFixed(5)
                };
                setBbox(currentBox);
                setAppliedBbox({ north, south, east, west });
                fetchAreaResources({ north, south, east, west });
            }
        } else {
            fetchRadiusResources();
        }
    };

    // Cattura i limiti attuali della viewport della mappa e aggiorna subito il riquadro grafico (senza muovere la vista o lo zoom)
    const handleUseCurrentViewport = () => {
        const map = mapRef.current;
        if (!map) {
            if (addToast) addToast('Mappa non pronta: attendi qualche secondo e riprova.', 'error');
            return;
        }

        const bounds = map.getBounds();
        const north = parseFloat(bounds.getNorth().toFixed(5));
        const south = parseFloat(bounds.getSouth().toFixed(5));
        const east = parseFloat(bounds.getEast().toFixed(5));
        const west = parseFloat(bounds.getWest().toFixed(5));

        setBbox({
            north: bounds.getNorth().toFixed(5),
            south: bounds.getSouth().toFixed(5),
            east: bounds.getEast().toFixed(5),
            west: bounds.getWest().toFixed(5)
        });
        setAppliedBbox({ north, south, east, west });
        if (addToast) addToast('Riquadro impostato sull\'area visibile della mappa.', 'success');
    };

    // Gestione submit del form BBOX: esegue la query mantenendo la posizione e lo zoom della mappa
    const handleAreaSearch = async (e) => {
        e.preventDefault();

        const north = Number(bbox.north);
        const south = Number(bbox.south);
        const east = Number(bbox.east);
        const west = Number(bbox.west);

        if ([north, south, east, west].some((v) => Number.isNaN(v))) {
            if (addToast) addToast('Inserisci coordinate area valide.', 'error');
            return;
        }

        if (south >= north || west >= east) {
            if (addToast) addToast('Bounding box non valida: verifica Nord/Sud e Est/Ovest.', 'error');
            return;
        }

        setIsGeoSearching(true);
        try {
            await fetchAreaResources({ north, south, east, west });
            setAppliedBbox({ north, south, east, west });
            if (addToast) addToast('Ricerca per area completata con successo!', 'success');
        } catch (err) {
            if (addToast) addToast(err.message || 'Errore durante la ricerca per area.', 'error');
        } finally {
            setIsGeoSearching(false);
        }
    };

    // Esegue la ricerca testuale nel catalogo (Full-Text Search)
    const handleTextSearch = async (e) => {
        e.preventDefault();
        if (searchQuery.trim().length < 2) {
            if (addToast) addToast("Inserisci almeno 2 caratteri per la ricerca.", "error");
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(`/api/books/search?q=${encodeURIComponent(searchQuery.trim())}`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            setSearchResults(data);

            if (data.length === 0) {
                if (addToast) addToast(`Nessun volume trovato per "${searchQuery}".`, "error");
            } else {
                if (addToast) addToast(`${data.length} volume/i trovato/i per "${searchQuery}".`, "success");
            }
        } catch {
            if (addToast) addToast("Errore durante la ricerca. Riprova.", "error");
        } finally {
            setIsSearching(false);
        }
    };

    // Reset della ricerca testuale e ritorno alla vista mappa
    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
    };

    // Inoltra una richiesta di prestito al backend (POST /api/loans) con lock transazionale
    const handleLoanRequest = async (bookId, ownerUsername) => {
        try {
            const res = await fetch('/api/loans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mock-user': user?.username
                },
                body: JSON.stringify({ book_id: bookId })
            });

            if (res.status === 201) {
                if (addToast) addToast(`Richiesta di consultazione/prestito inviata a ${ownerUsername}!`, 'success');
                setSelectedBook(null);
                // Ricarica la lista per riflettere il cambio di stato del libro
                if (geoMode === 'radius') fetchRadiusResources();
                else fetchAreaResources(appliedBbox);
            } else if (res.status === 409) {
                if (addToast) addToast('Volume già richiesto o non disponibile.', 'error');
            } else {
                const err = await res.json().catch(() => ({}));
                if (addToast) addToast(err.error || `Errore invio richiesta a ${ownerUsername}`, 'error');
            }
        } catch (e) {
            if (addToast) addToast(`Errore di rete nell'invio richiesta a ${ownerUsername}`, 'error');
        }
    };

    // Risolve l'URI della miniatura WebP
    const getCoverSrc = (coverThumb) => {
        if (!coverThumb) return null;
        return coverThumb.startsWith('thumb_') ? `/uploads/${coverThumb}` : `/images/${coverThumb}`;
    };

    return (
        <section aria-label="Mappa e ricerca" className="map-layout">
            {/* Modale di dettaglio libro aperta al click */}
            {selectedBook && (
                <BookDetail
                    book={selectedBook}
                    onClose={() => setSelectedBook(null)}
                    onRequestLoan={handleLoanRequest}
                />
            )}

            {/* Pannello dei controlli di ricerca */}
            <div className="map-controls">
                {/* Form di ricerca testuale con tag semantico e ruolo ARIA */}
                <form
                    onSubmit={handleTextSearch}
                    className="search-bar-form"
                    role="search"
                    aria-label="Ricerca testuale nel catalogo"
                >
                    <input
                        type="search"
                        id="text-search-input"
                        placeholder="Cerca per titolo, autore o categoria..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Termine di ricerca"
                        className="search-input"
                    />
                    <button type="submit" className="btn-action search-btn" disabled={isSearching}>
                        {isSearching ? '...' : <><SearchIcon />Cerca</>}
                    </button>
                    {searchResults !== null && (
                        <button type="button" className="btn-secondary search-btn" onClick={handleClearSearch}>
                            <CloseIcon />Reset
                        </button>
                    )}
                </form>

                {/* Risultati della ricerca testuale (quando attiva) */}
                {searchResults !== null && (
                    <div className="search-results-panel" aria-live="polite" aria-label="Risultati della ricerca">
                        {searchResults.length === 0 ? (
                            <p className="text-muted">Nessun volume trovato.</p>
                        ) : (
                            <ul className="search-results-list">
                                {searchResults.map(book => (
                                    <li key={book.book_id} className="search-result-item">
                                        {getCoverSrc(book.cover_thumb) && (
                                            <img
                                                src={getCoverSrc(book.cover_thumb)}
                                                alt=""
                                                aria-hidden="true"
                                                className="search-result-thumb"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <div className="search-result-info">
                                            <strong>{book.title}</strong>
                                            <span>{book.author}{book.publication_year ? `, ${book.publication_year}` : ''}</span>
                                            <small>Condiviso da: {book.owner === user?.username ? 'Te (Tuo volume)' : book.owner} · {book.category}</small>
                                        </div>
                                        <button
                                            className="btn-action"
                                            style={{ padding: '0.4rem 0.8rem', flexShrink: 0 }}
                                            onClick={() => setSelectedBook(book)}
                                            aria-label={`Visualizza scheda di ${book.title}`}
                                        >
                                            Dettagli
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Filtri spaziali (visibili solo quando non è attiva la ricerca testuale) */}
                {searchResults === null && (
                    <>
                        {/* Selettore moderno della modalità geografica (Segmented Control) */}
                        <div className="geo-mode-switcher" role="radiogroup" aria-label="Modalità di filtro geografico">
                            <button
                                type="button"
                                className={`geo-mode-btn ${geoMode === 'radius' ? 'active' : ''}`}
                                onClick={() => handleSwitchMode('radius')}
                                role="radio"
                                aria-checked={geoMode === 'radius'}
                            >
                                <RadarIcon tight /> Ricerca per distanza
                            </button>
                            <button
                                type="button"
                                className={`geo-mode-btn ${geoMode === 'area' ? 'active' : ''}`}
                                onClick={() => handleSwitchMode('area')}
                                role="radio"
                                aria-checked={geoMode === 'area'}
                            >
                                <MapIcon tight /> Ricerca per area (BBOX)
                            </button>
                        </div>

                        {/* Modalità 1: Slider per il raggio in km */}
                        {geoMode === 'radius' && (
                            <div className="radius-panel">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <label htmlFor="radius-slider" style={{ margin: 0, fontWeight: 600 }}>
                                        Raggio di ricerca:
                                    </label>
                                    <strong style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>{radius / 1000} km</strong>
                                </div>
                                <input
                                    type="range" id="radius-slider"
                                    min="5000" max="400000" step="5000"
                                    value={radius} onChange={(e) => setRadius(Number(e.target.value))}
                                    aria-valuemin="5000" aria-valuemax="400000" aria-valuenow={radius}
                                />
                                <p className="text-muted" style={{ fontSize: '0.82rem', margin: '0.4rem 0 0 0' }}>
                                    Posizioni stimate (per la tutela della privacy dei custodi).
                                </p>
                            </div>
                        )}

                        {/* Modalità 2: Flusso compatto a 2 passi per la ricerca BBOX */}
                        {geoMode === 'area' && (
                            <form onSubmit={handleAreaSearch} className="bbox-panel">
                                {/* Barra superiore: I due tasti di azione affiancati */}
                                <div className="bbox-actions-bar">
                                    <button
                                        type="button"
                                        className="btn-capture-viewport"
                                        onClick={handleUseCurrentViewport}
                                        title="Rileva i confini dell'area inquadrata nella mappa"
                                    >
                                        <MapIcon tight /> 1. Cattura vista mappa
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-bbox-submit"
                                        disabled={isGeoSearching}
                                        title="Cerca i volumi disponibili all'interno del riquadro"
                                    >
                                        {isGeoSearching ? 'Ricerca in corso...' : <><SearchIcon tight /> 2. Cerca nell'area</>}
                                    </button>
                                </div>

                                {/* Striscia compatta coordinate GPS (N, S, E, O) */}
                                <div className="bbox-coords-strip">
                                    <div className="bbox-coord-chip">
                                        <span className="coord-tag">Nord</span>
                                        <input
                                            id="bbox-north"
                                            type="number"
                                            step="0.00001"
                                            value={bbox.north}
                                            onChange={(e) => setBbox((prev) => ({ ...prev, north: e.target.value }))}
                                            aria-label="Latitudine Nord"
                                        />
                                    </div>
                                    <div className="bbox-coord-chip">
                                        <span className="coord-tag">Sud</span>
                                        <input
                                            id="bbox-south"
                                            type="number"
                                            step="0.00001"
                                            value={bbox.south}
                                            onChange={(e) => setBbox((prev) => ({ ...prev, south: e.target.value }))}
                                            aria-label="Latitudine Sud"
                                        />
                                    </div>
                                    <div className="bbox-coord-chip">
                                        <span className="coord-tag">Est</span>
                                        <input
                                            id="bbox-east"
                                            type="number"
                                            step="0.00001"
                                            value={bbox.east}
                                            onChange={(e) => setBbox((prev) => ({ ...prev, east: e.target.value }))}
                                            aria-label="Longitudine Est"
                                        />
                                    </div>
                                    <div className="bbox-coord-chip">
                                        <span className="coord-tag">Ovest</span>
                                        <input
                                            id="bbox-west"
                                            type="number"
                                            step="0.00001"
                                            value={bbox.west}
                                            onChange={(e) => setBbox((prev) => ({ ...prev, west: e.target.value }))}
                                            aria-label="Longitudine Ovest"
                                        />
                                    </div>
                                </div>

                                <small className="bbox-helper-text text-muted">
                                    Inquadra la mappa e clicca su <strong>1. Cattura</strong> per prelevare le coordinate, poi su <strong>2. Cerca</strong> per filtrare i libri nel riquadro.
                                </small>
                            </form>
                        )}
                    </>
                )}
            </div>

            {/* Rendering della mappa Leaflet quando non ci sono risultati testuali aperti */}
            {searchResults === null && (
                <MapContainer center={[userCoordinates.lat, userCoordinates.lng]} zoom={8} className="leaflet-container">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <MapInstanceBridge mapRef={mapRef} />

                    {/* Cerchio del raggio di ricerca attorno alla posizione utente (in modalità raggio) */}
                    {geoMode === 'radius' && (
                        <Circle
                            center={[userCoordinates.lat, userCoordinates.lng]}
                            radius={radius}
                            interactive={false}
                            pathOptions={{ color: 'var(--primary-light)', fillColor: 'var(--primary-light)', fillOpacity: 0.08 }}
                        />
                    )}

                    {/* Rettangolo indicatore del BBOX (in modalità area) */}
                    {geoMode === 'area' && (
                        <Rectangle
                            bounds={areaBounds}
                            pathOptions={{
                                color: 'var(--primary-light)',
                                weight: 2,
                                fillColor: 'var(--primary-light)',
                                fillOpacity: 0.12,
                                dashArray: '8, 6'
                            }}
                        />
                    )}

                    {/* Marker della posizione di riferimento dell'utente */}
                    <Marker position={[userCoordinates.lat, userCoordinates.lng]} icon={homeIcon} zIndexOffset={1000}>
                        <Popup>
                            <strong><PinIcon />Il tuo indirizzo di riferimento</strong><br />
                            Da qui parte la tua ricerca.
                        </Popup>
                    </Marker>

                    {/* 
                      Layer Sonar Ibrido per i libri:
                      - 3 Circle concentrici con interactive={false} per l'effetto visivo radar;
                      - 1 CircleMarker che intercetta i click dell'utente e apre il Popup.
                    */}
                    {books.map((book) => (
                        <React.Fragment key={book.book_id}>
                            {/* Anello radar esterno animato via CSS */}
                            <Circle
                                center={[book.lat, book.lng]}
                                radius={1400}
                                interactive={false}
                                pathOptions={{
                                    className: 'radar-ring',
                                    color: ACCENT_COLOR,
                                    weight: 3,
                                    fillOpacity: 0
                                }}
                            />

                            {/* Anello eco intermedio (72% del raggio) */}
                            <Circle
                                center={[book.lat, book.lng]}
                                radius={1400 * 0.72}
                                interactive={false}
                                pathOptions={{
                                    color: ACCENT_COLOR,
                                    weight: 1.5,
                                    opacity: 0.4,
                                    fillOpacity: 0,
                                    dashArray: '6, 7'
                                }}
                            />

                            {/* Anello eco interno (44% del raggio) */}
                            <Circle
                                center={[book.lat, book.lng]}
                                radius={1400 * 0.44}
                                interactive={false}
                                pathOptions={{
                                    color: ACCENT_COLOR,
                                    weight: 1.5,
                                    opacity: 0.22,
                                    fillOpacity: 0,
                                    dashArray: '6, 7'
                                }}
                            />

                            {/* Marker puntuale cliccabile per aprire la scheda e richiedere il prestito */}
                            <CircleMarker
                                center={[book.lat, book.lng]}
                                radius={8}
                                pathOptions={{
                                    color: MARKER_STROKE,
                                    weight: 2,
                                    fillColor: ACCENT_COLOR,
                                    fillOpacity: 1
                                }}
                            >
                                <Popup>
                                    <div className="book-popup" style={{ textAlign: 'center', minWidth: '150px' }}>
                                        <small style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
                                            <MapIcon />Posizione stimata
                                        </small>
                                        {getCoverSrc(book.cover_thumb) && (
                                            <img
                                                src={getCoverSrc(book.cover_thumb)}
                                                alt={`Copertina del libro ${book.title}`}
                                                style={{ width: '100%', height: '120px', objectFit: 'contain', marginBottom: '8px', borderRadius: '4px' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <div style={{ textAlign: 'left' }}>
                                            <strong style={{ fontSize: '1.1rem' }}>{book.title}</strong><br />
                                            <span>{book.author}</span>
                                            {book.publication_year && <><br /><small>{book.publication_year}</small></>}
                                            <br />
                                            <small style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                                                Condiviso da: {book.owner}
                                            </small><br />
                                            <button
                                                className="btn-action"
                                                style={{ marginTop: '6px', width: '100%', padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'var(--text-muted)' }}
                                                onClick={() => setSelectedBook(book)}
                                            >
                                                <BookIcon />Scheda completa
                                            </button>
                                            {book.status === 'available' ? (
                                                <button
                                                    className="btn-action"
                                                    style={{ marginTop: '6px', width: '100%', padding: '0.6rem' }}
                                                    onClick={() => handleLoanRequest(book.book_id, book.owner)}
                                                >
                                                    Richiedi in prestito
                                                </button>
                                            ) : (
                                                <span className="badge-busy" style={{ display: 'block', marginTop: '6px', textAlign: 'center' }}>
                                                    Non disponibile
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        </React.Fragment>
                    ))}
                </MapContainer>
            )}
        </section>
    );
};

export default MapExplorer;