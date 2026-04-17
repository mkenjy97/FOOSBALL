import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, doc, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLocations } from '../context/LocationContext';
import { MapPin, Plus, Building2, ChevronLeft, Crosshair } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

// Icons for the map
const customIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#e6b600" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3" fill="#000"></circle>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

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

function LocationPicker({ onSelect, position }) {
    useMapEvents({
        click(e) {
            onSelect(e.latlng);
        },
    });
    return position ? <Marker position={position} icon={customIcon} /> : null;
}

function ChangeView({ center, trigger }) {
    const map = useMap();
    useEffect(() => {
        if (center && trigger > 0) map.setView(center, 15);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger]);
    return null;
}

export default function RegisterLocation() {
    const { user } = useAuth();
    const { locations } = useLocations();
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    const [newLocation, setNewLocation] = useState({ name: '', city: '', lat: null, lng: null });
    const [addressSearch, setAddressSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTrigger, setSearchTrigger] = useState(0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newLocation.name.trim()) return;
        setLoading(true);
        try {
            const isSuperadmin = user.role === 'superadmin';
            const locStatus = isSuperadmin ? 'confirmed' : 'pending';

            const locRef = await addDoc(collection(db, "locations"), {
                name: newLocation.name,
                city: newLocation.city,
                latitude: newLocation.lat || 0,
                longitude: newLocation.lng || 0,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                status: locStatus
            });

            if (!isSuperadmin) {
                // Notify Managers
                const q = query(collection(db, "players"), where("role", "==", "manager"));
                const snap = await getDocs(q);
                
                const batch = writeBatch(db);
                snap.docs.forEach(mgrDoc => {
                    const notifRef = doc(collection(db, "notifications"));
                    batch.set(notifRef, {
                        recipientId: mgrDoc.id,
                        senderId: user.uid,
                        senderName: user.name || user.email,
                        type: 'location_proposal',
                        locationId: locRef.id,
                        locationName: newLocation.name,
                        status: 'unread',
                        createdAt: serverTimestamp()
                    });
                });
                await batch.commit();
            }

            const message = isSuperadmin
                ? t('registerLoc.successAdminMsg', 'Location added successfully!')
                : t('registerLoc.successMsg', 'Proposal submitted! A manager will review it soon.');

            navigate('/locations', { state: { message } });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddressSearch = async () => {
        if (!addressSearch.trim()) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setNewLocation(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon) }));
                setSearchTrigger(prev => prev + 1);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 pb-32 px-2">
            <button 
                onClick={() => navigate('/locations')}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
                <ChevronLeft size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('common.backToOffices', 'Back to Offices')}</span>
            </button>

            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{t('registerLoc.title', 'Propose New Base')}</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{t('registerLoc.subtitle', 'Submission requires manager verification')}</p>
            </div>

            <form onSubmit={handleSubmit} className="glass p-6 rounded-[32px] border border-white/5 space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-1">
                        <Building2 size={18} className="text-brand" />
                        <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{t('registerLoc.generalInfo', 'General Information')}</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">{t('locations.namePlaceholder', 'Office Name')}</label>
                            <input
                                type="text"
                                placeholder="e.g. NTT Tokyo Headquarters"
                                value={newLocation.name}
                                onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-base md:text-sm text-white font-bold focus:outline-none focus:border-brand/50 transition-all placeholder:text-zinc-700"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">{t('locations.cityPlaceholder', 'City')}</label>
                            <input
                                type="text"
                                placeholder="e.g. Tokyo"
                                value={newLocation.city}
                                onChange={e => setNewLocation({ ...newLocation, city: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-base md:text-sm text-white font-bold focus:outline-none focus:border-brand/50 transition-all placeholder:text-zinc-700"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-1">
                        <MapPin size={18} className="text-brand" />
                        <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{t('registerLoc.geotagging', 'Geotagging')}</h3>
                    </div>

                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t('registerLoc.findAddress', 'Find address...')}
                                value={addressSearch}
                                onChange={e => setAddressSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base md:text-xs font-bold text-white focus:outline-none focus:border-brand/40"
                            />
                            <button 
                                type="button" 
                                onClick={handleAddressSearch}
                                className="bg-white/10 hover:bg-white/20 px-6 rounded-xl text-[10px] font-black uppercase transition-colors"
                            >
                                {t('common.go', 'Go')}
                            </button>
                        </div>
                        
                        <div className="h-64 relative rounded-[24px] overflow-hidden text-dark theme-aware-map border border-white/5 shadow-inner">
                            <MapContainer center={[45.4642, 9.1900]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                
                                {locations.filter(l => l.latitude && l.longitude && (l.status === 'confirmed' || !l.status)).map(loc => (
                                    <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={existingIcon}>
                                        <Popup>
                                            <div className="text-white p-1">
                                                <p className="font-bold text-[10px] uppercase">{loc.name}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                <LocationPicker 
                                    position={newLocation.lat ? [newLocation.lat, newLocation.lng] : null}
                                    onSelect={(latlng) => setNewLocation({ ...newLocation, lat: latlng.lat, lng: latlng.lng })}
                                />
                                <ChangeView 
                                    center={newLocation.lat ? [newLocation.lat, newLocation.lng] : null} 
                                    trigger={searchTrigger}
                                />
                            </MapContainer>
                            <div className="absolute bottom-3 left-3 right-3 bg-dark/80 backdrop-blur-md p-3 rounded-2xl text-[9px] font-black uppercase text-zinc-400 z-[1000] border border-white/5 flex justify-between items-center">
                                <span>{newLocation.lat ? `Lat: ${newLocation.lat.toFixed(4)} Lng: ${newLocation.lng.toFixed(4)}` : t('registerLoc.tapMap', 'Tap map to drop pin')}</span>
                                <Crosshair size={12} className={newLocation.lat ? 'text-brand' : 'text-zinc-600'} />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-dark font-black py-5 rounded-[24px] flex items-center justify-center gap-3 uppercase tracking-widest text-xs hover:bg-brand transition-all shadow-xl disabled:opacity-50"
                >
                    <Plus size={18} /> {loading ? t('registerLoc.submitting', 'Submitting proposal...') : t('registerLoc.submitBtn', 'Submit Proposal')}
                </button>
            </form>
        </div>
    );
}
