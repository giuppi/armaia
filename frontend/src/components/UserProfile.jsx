import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LocationPicker = ({ setLat, setLng }) => {
    useMapEvents({
        click(e) {
            setLat(e.latlng.lat.toFixed(5));
            setLng(e.latlng.lng.toFixed(5));
        },
    });
    return null;
};

const UserProfile = ({ user, userCoords, setUserCoords, addToast }) => {
    const [lat, setLat] = useState(userCoords.lat);
    const [lng, setLng] = useState(userCoords.lng);

    useEffect(() => {
        setLat(userCoords.lat);
        setLng(userCoords.lng);
    }, [userCoords.lat, userCoords.lng]);

    const handleUpdateLocation = (e) => {
        e.preventDefault();
        // Propaga l'aggiornamento allo stato globale per ricentrare le mappe di ricerca
        setUserCoords({ lat: parseFloat(lat), lng: parseFloat(lng) });
        addToast("Indirizzo di riferimento aggiornato. La tua ricerca partirà da qui.", "success");
    };

    return (
        <section className="card-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">Il Mio Profilo Speleologico</h2>

            <div className="profile-info-grid">
                <div className="info-badge">
                    <span>Username</span>
                    <strong>{user.username}</strong>
                </div>
                <div className="info-badge">
                    <span>Email Istituzionale</span>
                    <strong>{user.email}</strong>
                </div>
            </div>

            <hr className="divider" aria-hidden="true" />

            <h3>Indirizzo di riferimento</h3>
            <p className="text-muted" id="map-instructions">
                Può essere la tua abitazione o la sede del gruppo speleo. Clicca direttamente sulla mappa o inserisci le coordinate esatte. Gli altri utenti non vedranno mai il tuo punto esatto, ma solo una posizione stimata.
            </p>

            <div style={{ height: '300px', marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <MapContainer
                    center={[lat, lng]}
                    zoom={9}
                    style={{ height: '100%', width: '100%' }}
                    aria-label="Mappa interattiva per la selezione delle coordinate"
                    aria-describedby="map-instructions"
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <LocationPicker setLat={setLat} setLng={setLng} />
                    <Marker position={[lat, lng]} alt="Posizione attuale selezionata" />
                </MapContainer>
            </div>

            <form onSubmit={handleUpdateLocation} className="grid-form coord-form">
                <div className="form-group">
                    <label htmlFor="lat">Latitudine:</label>
                    <input
                        type="number" step="0.00001" id="lat"
                        value={lat} onChange={(e) => setLat(e.target.value)}
                        required aria-required="true"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="lng">Longitudine:</label>
                    <input
                        type="number" step="0.00001" id="lng"
                        value={lng} onChange={(e) => setLng(e.target.value)}
                        required aria-required="true"
                    />
                </div>
                <button type="submit" className="btn-action">Conferma indirizzo</button>
            </form>
        </section>
    );
};

export default UserProfile;