import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLocations } from '../context/LocationContext';
import { MapPin, Plus, Building2, UserPlus, UserMinus, Search, Trash2, Edit3, X, Check } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

const existingIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3" fill="#000000"></circle>
        </svg>
    `),
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
});

export default function Locations() {
    const { user, showAsManager } = useAuth();
    const { locations } = useLocations();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locationPage = useLocation();
    
    const [userLocs, setUserLocs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingLoc, setEditingLoc] = useState(null);

    // Handle deep links / QR code redirects
    useEffect(() => {
        const params = new URLSearchParams(locationPage.search);
        const qLocationId = params.get('locationId');
        
        if (qLocationId && locations.length > 0) {
            const loc = locations.find(l => l.id === qLocationId);
            if (loc) {
                setSearchQuery(loc.name);
                // Clear the URL parameter so refreshing doesn't get stuck
                navigate('/locations', { replace: true });
                
                // Scroll down to the list area with a slight delay to allow rendering
                setTimeout(() => {
                    const el = document.getElementById(`loc-${loc.id}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        }
    }, [locationPage.search, locations, navigate]);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "players", user.uid), (snap) => {
            if (snap.exists()) {
                setUserLocs(snap.data().locationIds || []);
            }
        });
        return () => unsub();
    }, [user]);



    const toggleJoin = async (locId) => {
        const isJoined = userLocs.includes(locId);
        const playerRef = doc(db, "players", user.uid);
        const loc = locations.find(l => l.id === locId);
        
        try {
            if (isJoined) {
                await updateDoc(playerRef, {
                    locationIds: arrayRemove(locId)
                });
                alert(t('locations.leaveSuccess', 'You have successfully left {{name}}.', { name: loc?.name || 'the location' }));
            } else {
                const updates = { locationIds: arrayUnion(locId) };
                if (user.tutorialCompleted === false && user.tutorialStep === 1) {
                    updates.tutorialStep = 2;
                }
                await updateDoc(playerRef, updates);
                alert(t('locations.joinSuccess', 'You have successfully joined {{name}}!', { name: loc?.name || 'the location' }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteLoc = async (id) => {
        if (window.confirm(t('locations.deleteConfirm', 'Are you sure you want to delete this location? This cannot be undone.'))) {
            try {
                await deleteDoc(doc(db, "locations", id));
            } catch (err) {
                console.error("Error deleting location:", err);
            }
        }
    };

    const handleUpdateLoc = async (e) => {
        e.preventDefault();
        if (!editingLoc.name.trim()) return;
        try {
            await updateDoc(doc(db, "locations", editingLoc.id), {
                name: editingLoc.name,
                city: editingLoc.city
            });
            setEditingLoc(null);
        } catch (err) {
            console.error("Error updating location:", err);
        }
    };

    const filteredOffices = locations.filter(loc => 
        (loc.status === 'confirmed' || !loc.status) &&
        (loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (loc.city || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleSelectFromMap = (loc) => {
        setSearchQuery(loc.name);
        setTimeout(() => {
            const el = document.getElementById(`loc-${loc.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const skipTutorial = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, "players", user.uid), { tutorialCompleted: true });
        } catch(err) {
            console.error("Error skipping tutorial", err);
        }
    };

    const handleProposeLocation = () => {
        alert(t('locations.proposeAlert', "L'aggiunta di una nuova sede richiede l'approvazione di un manager."));
        navigate('/locations/register');
    };

    return (
        <div className="space-y-8 pb-32">
            {user?.tutorialCompleted === false && (
                <div className="mx-2 mt-4 p-5 rounded-3xl bg-brand/10 border border-brand/30 flex flex-col gap-3 shadow-lg shadow-brand/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <MapPin size={64} className="text-brand" />
                    </div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <h3 className="text-brand font-black uppercase tracking-tight text-xl mb-1">{t('locations.tutorial.welcome', 'Welcome! 👋')}</h3>
                            {user.tutorialStep === 1 ? (
                                <p className="text-sm font-bold text-white">
                                    {t('locations.tutorial.step1', 'First, join an Office by clicking the "Join" button.')}
                                </p>
                            ) : (
                                <p className="text-sm font-bold text-white">
                                    {t('locations.tutorial.step2_nav', 'Great! Now click on New Match in the bottom navigation bar.')}
                                </p>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={skipTutorial}
                        className="text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-white transition-colors text-left mt-2 relative z-10 w-fit"
                    >
                        {t('locations.tutorial.skip', 'Skip Tutorial')}
                    </button>
                </div>
            )}

            <div className="px-2 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase transition-colors">{t('locations.title', 'Locations')}</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{t('locations.subtitle', 'Multi-Office Management')}</p>
                </div>
                <button
                    onClick={handleProposeLocation}
                    className="flex items-center gap-2 bg-brand/10 border border-brand/30 text-brand px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand/20 transition-all"
                >
                    <Plus size={14} />
                    {t('locations.proposeBtn', 'Nuova Sede')}
                </button>
            </div>

            {/* Global Map Overview */}
            {locations.length > 0 && (
                <div className="px-2 h-64 theme-aware-map">
                    <MapContainer center={[45.4642, 9.1900]} zoom={4} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {locations.filter(l => l.latitude && l.longitude).map(loc => (
                            <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={existingIcon}>
                                <Popup>
                                    <div className="text-white p-1 flex flex-col gap-2 min-w-[120px]">
                                        <div>
                                            <p className="font-black text-sm uppercase leading-none">{loc.name}</p>
                                            <p className="text-[10px] opacity-70 mt-1">{loc.city}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleSelectFromMap(loc)}
                                            className="w-full bg-brand text-[#070e27] text-[8px] font-black uppercase py-2 rounded-lg hover:opacity-90 transition-opacity"
                                        >
                                            {t('locations.viewOffice', 'View Office')}
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            )}



            {/* Location List */}
            <div className="space-y-4">
                <div className="px-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-brand" />
                        <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{t('locations.available', 'Available Offices')}</h3>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder={t('locations.searchPlaceholder', 'Find a specific office...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-base md:text-sm font-bold focus:outline-none focus:border-brand/40 transition-all placeholder:text-zinc-600"
                        />
                    </div>
                </div>
                
                <div id="location-list" className="px-2 space-y-3">
                    {filteredOffices.length === 0 ? (
                        <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px] tracking-widest">
                            {t('locations.noMatches', 'No locations match your search')}
                        </div>
                    ) : (
                        filteredOffices.map((loc) => {
                            const isJoined = userLocs.includes(loc.id);
                            return (
                                <div key={loc.id} id={`loc-${loc.id}`} className={`glass p-5 rounded-[28px] border transition-all duration-500 flex flex-col gap-4 group ${searchQuery.toLowerCase() === loc.name.toLowerCase() ? 'border-brand shadow-lg shadow-brand/10 scale-[1.02]' : 'border-white/5'}`}>
                                    {editingLoc && editingLoc.id === loc.id ? (
                                        <form onSubmit={handleUpdateLoc} className="space-y-4 w-full">
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editingLoc.name}
                                                    onChange={e => setEditingLoc({ ...editingLoc, name: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-base md:text-xs font-bold text-white focus:outline-none focus:border-brand/40"
                                                    placeholder={t('locations.namePlaceholder', 'Office Name')}
                                                    autoFocus
                                                />
                                                <input
                                                    type="text"
                                                    value={editingLoc.city}
                                                    onChange={e => setEditingLoc({ ...editingLoc, city: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-base md:text-xs font-bold text-white focus:outline-none focus:border-brand/40"
                                                    placeholder={t('locations.cityPlaceholder', 'City')}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="submit" className="flex-1 bg-brand text-dark font-black py-2 rounded-xl text-[10px] uppercase flex items-center justify-center gap-1">
                                                    <Check size={14} /> {t('common.save', 'Save')}
                                                </button>
                                                <button type="button" onClick={() => setEditingLoc(null)} className="flex-1 bg-white/5 text-white font-black py-2 rounded-xl text-[10px] uppercase flex items-center justify-center gap-1">
                                                    <X size={14} /> {t('common.cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isJoined ? 'bg-brand text-dark shadow-lg shadow-brand/20' : 'bg-white/5 text-zinc-500'}`}>
                                                        <Building2 size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-white uppercase tracking-tight">{loc.name}</h4>
                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{loc.city || 'Global'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {user?.role === 'superadmin' && !showAsManager && (
                                                        <>
                                                            <button 
                                                                onClick={() => setEditingLoc(loc)}
                                                                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white flex items-center justify-center transition-colors"
                                                            >
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteLoc(loc.id)}
                                                                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 flex items-center justify-center transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => toggleJoin(loc.id)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                                            isJoined 
                                                            ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                                                            : 'bg-white/5 text-white border border-white/10 hover:bg-white hover:text-dark'
                                                        }`}
                                                    >
                                                        {isJoined ? <UserMinus size={14} /> : <UserPlus size={14} />}
                                                        {isJoined ? t('locations.leave', 'Leave') : t('locations.join', 'Join')}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
