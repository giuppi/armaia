import React, { useState, useEffect, useCallback } from 'react';
import AuthForm from './components/AuthForm';
import MapExplorer from './components/MapExplorer';
import LoanManager from './components/LoanManager';
import AdminDashboard from './components/AdminDashboard';
import UserProfile from './components/UserProfile';
import Toast from './components/Toast';
import MyLibrary from './components/MyLibrary';
import { PinIcon, RadarIcon, BookIcon, LoanIcon, ChartIcon } from './components/UiIcons';

const App = () => {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('radar');
    const [toast, setToast] = useState(null);
    const [userCoords, setUserCoords] = useState({ lat: 44.4056, lng: 8.9462 });

    // Funzione memorizzata per mostrare toast senza causare re-render non necessari nei figli
    const addToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    // Quando l'utente effettua il login, sincronizziamo il centro della mappa con le coordinate del suo profilo
    useEffect(() => {
        if (user?.lat && user?.lng) {
            setUserCoords({
                lat: parseFloat(user.lat),
                lng: parseFloat(user.lng)
            });
        }
    }, [user]);

    // Se l'utente non è autenticato, mostriamo la schermata di login/registrazione
    if (!user) {
        return (
            <main className="auth-screen">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <AuthForm onLoginSuccess={(data) => setUser(data)} addToast={addToast} />
            </main>
        );
    }

    return (
        <div className="app-container">
            {/* Notifica toast globale */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sidebar di navigazione accessibile tramite ruoli WAI-ARIA tablist */}
            <aside className="sidebar" aria-label="Menu di navigazione principale">
                <div className="sidebar-header">
                    <h1>Armâia dei Nodi</h1>
                    <small>Utente attivo: <strong>{user.username}</strong></small>
                </div>

                <nav className="sidebar-menu" role="tablist" aria-label="Sezioni principali">
                    <button 
                        id="tab-btn-profile" 
                        className={activeTab === 'profile' ? 'active' : ''} 
                        onClick={() => setActiveTab('profile')} 
                        role="tab" 
                        aria-selected={activeTab === 'profile'} 
                        aria-controls="tab-panel-profile"
                    >
                        <PinIcon />Profilo e posizione
                    </button>
                    <button 
                        id="tab-btn-radar" 
                        className={activeTab === 'radar' ? 'active' : ''} 
                        onClick={() => setActiveTab('radar')} 
                        role="tab" 
                        aria-selected={activeTab === 'radar'} 
                        aria-controls="tab-panel-radar"
                    >
                        <RadarIcon />Cerca libri
                    </button>
                    <button 
                        id="tab-btn-library" 
                        className={activeTab === 'library' ? 'active' : ''} 
                        onClick={() => setActiveTab('library')} 
                        role="tab" 
                        aria-selected={activeTab === 'library'} 
                        aria-controls="tab-panel-library"
                    >
                        <BookIcon />La mia libreria
                    </button>
                    <button 
                        id="tab-btn-loans" 
                        className={activeTab === 'loans' ? 'active' : ''} 
                        onClick={() => setActiveTab('loans')} 
                        role="tab" 
                        aria-selected={activeTab === 'loans'} 
                        aria-controls="tab-panel-loans"
                    >
                        <LoanIcon />Gestione Prestiti
                    </button>
                    <button 
                        id="tab-btn-stats" 
                        className={activeTab === 'stats' ? 'active' : ''} 
                        onClick={() => setActiveTab('stats')} 
                        role="tab" 
                        aria-selected={activeTab === 'stats'} 
                        aria-controls="tab-panel-stats"
                    >
                        <ChartIcon />Statistiche
                    </button>
                </nav>

                <footer className="sidebar-footer">
                    {/* Logout per la demo: azzera lo stato utente e torna al login */}
                    <button className="btn-logout" onClick={() => setUser(null)}>Esci</button>
                </footer>
            </aside>

            {/* Area principale dei contenuti */}
            <main className="content-area">
                <div className="content-wrapper">
                    {/* Contenitore associato alla scheda selezionata */}
                    <div 
                        id={`tab-panel-${activeTab}`} 
                        role="tabpanel" 
                        aria-labelledby={`tab-btn-${activeTab}`} 
                        tabIndex={0}
                    >
                        {activeTab === 'profile' && (
                            <UserProfile 
                                user={user} 
                                userCoords={userCoords} 
                                setUserCoords={setUserCoords} 
                                addToast={addToast} 
                            />
                        )}
                        {activeTab === 'radar' && (
                            <MapExplorer 
                                userCoordinates={userCoords} 
                                addToast={addToast} 
                                user={user} 
                            />
                        )}
                        {activeTab === 'library' && (
                            <MyLibrary 
                                user={user} 
                                addToast={addToast} 
                            />
                        )}
                        {activeTab === 'loans' && (
                            <LoanManager 
                                user={user} 
                                addToast={addToast} 
                            />
                        )}
                        {activeTab === 'stats' && (
                            <AdminDashboard />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;