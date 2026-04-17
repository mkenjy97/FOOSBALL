import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Search, ArrowUpDown, Trophy, Users, User, MapPin, Shield, Trash2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useLocations } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';


export default function Players() {
    const { user, showAsManager } = useAuth();
    const { t } = useTranslation();
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('won'); // Default by wins
    const [sortOrder, setSortOrder] = useState('desc'); // Highest wins first
    const [mode, setMode] = useState('2v2'); // '2v2' or '1v1'
    const { selectedLocationId, locations } = useLocations();
    const currentLocation = locations.find(l => l.id === selectedLocationId);
    const [loading, setLoading] = useState(true);
    const [editingPlayer, setEditingPlayer] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
            setPlayers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
            setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubPlayers();
            unsubMatches();
        };
    }, []);

    // Filter data by location
    const filteredPlayers = selectedLocationId === 'all'
        ? players
        : players.filter(p => p.locationIds?.includes(selectedLocationId));

    const filteredMatches = (selectedLocationId === 'all'
        ? matches
        : matches.filter(m => m.locationId === selectedLocationId))
        .filter(m => m.status !== 'pending');

    // Calculate dynamic stats based on mode and location
    const playersWithStats = filteredPlayers.map(player => {
        const modeMatches = filteredMatches.filter(m => {
            const isType = m.type ? m.type === mode : (mode === '1v1' ? m.teamA.length === 1 : m.teamA.length === 2);
            return isType && [...m.teamA, ...m.teamB].includes(player.id);
        });

        const played = modeMatches.length;
        const won = modeMatches.filter(m => {
            const team = m.teamA.includes(player.id) ? 'A' : 'B';
            return m.winner === team;
        }).length;

        return { ...player, played, won };
    });

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const filteredAndSortedPlayers = playersWithStats
        .filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (sortBy === 'name') {
                valA = (valA || '').toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    const handleDeletePlayer = async (id) => {
        if (window.confirm(t('players.deleteConfirm', 'Are you sure you want to remove this player? All their data will be lost.'))) {
            try {
                await deleteDoc(doc(db, "players", id));
            } catch (err) {
                console.error("Error deleting player:", err);
            }
        }
    };

    const handleUpdateRole = async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, "players", editingPlayer.id), {
                role: editingPlayer.role
            });
            setEditingPlayer(null);
        } catch (err) {
            console.error("Error updating role:", err);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{t('players.loading', 'Loading Rosters')}</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="px-2 flex items-center gap-2">
                <MapPin className="text-brand w-[10px] h-[10px]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {t('common.viewing', 'Viewing')}: {selectedLocationId === 'all' ? t('common.allLocations', 'All Locations') : (currentLocation?.name || t('common.loading', 'Loading...'))}
                </span>
            </div>

            <div className="px-2 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter">{t('players.title', 'PLAYERS')}</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
                        {t('players.subtitle', 'League Directory')} &middot; {filteredPlayers.length} {t('players.playersCount', 'Players')}
                    </p>
                </div>
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                    <button onClick={() => setMode('2v2')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 ${mode === '2v2' ? 'bg-brand text-black shadow-lg shadow-brand/20' : 'text-zinc-500'}`}><Users size={12}/> {t('players.mode2v2', '2V2')}</button>
                    <button onClick={() => setMode('1v1')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 ${mode === '1v1' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-zinc-500'}`}><User size={12}/> {t('players.mode1v1', '1V1')}</button>
                </div>
            </div>

            <div className="px-2 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder={t('players.searchPlaceholder', 'Filter by name...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-brand/40 transition-all placeholder:text-zinc-600"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                        onClick={() => toggleSort('name')}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortBy === 'name' ? 'bg-brand border-brand text-black' : 'bg-white/5 border-white/5 text-zinc-500'}`}
                    >
                        {t('players.sortName', 'Name')} <ArrowUpDown size={12} />
                    </button>
                    <button
                        onClick={() => toggleSort('played')}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortBy === 'played' ? 'bg-brand border-brand text-black' : 'bg-white/5 border-white/5 text-zinc-500'}`}
                    >
                        {t('players.sortGames', 'Games')} <ArrowUpDown size={12} />
                    </button>
                    <button
                        onClick={() => toggleSort('won')}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortBy === 'won' ? 'bg-brand border-brand text-black' : 'bg-white/5 border-white/5 text-zinc-500'}`}
                    >
                        {t('players.sortWins', 'Wins')} <ArrowUpDown size={12} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-2">
                <AnimatePresence mode="popLayout">
                    {filteredAndSortedPlayers.map((p, i) => (
                        <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => !editingPlayer && navigate(`/player/${p.id}`)}
                            className={`glass p-4 rounded-[32px] flex flex-col gap-4 border transition-all ${editingPlayer?.id === p.id ? 'border-brand' : 'border-white/5 hover:border-brand/30'} group ${!editingPlayer ? 'cursor-pointer active:scale-95' : ''}`}
                        >
                            {editingPlayer && editingPlayer.id === p.id ? (
                                <form onSubmit={handleUpdateRole} className="space-y-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Avatar name={p.name} size="sm" />
                                        <h3 className="font-black text-white uppercase text-sm">{p.name}</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">{t('players.assignRole', 'Assign Role')}</label>
                                        <select 
                                            value={editingPlayer.role || 'user'}
                                            onChange={e => setEditingPlayer({ ...editingPlayer, role: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-brand/40"
                                        >
                                            <option value="user">{t('players.roleUser', 'User')}</option>
                                            <option value="manager">{t('players.roleManager', 'Manager')}</option>
                                            <option value="superadmin">{t('players.roleSuperadmin', 'Superadmin')}</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-brand text-dark font-black py-2 rounded-xl text-[10px] uppercase flex items-center justify-center gap-1">
                                            <Check size={14} /> {t('common.update', 'Update')}
                                        </button>
                                        <button type="button" onClick={() => setEditingPlayer(null)} className="flex-1 bg-white/5 text-white font-black py-2 rounded-xl text-[10px] uppercase flex items-center justify-center gap-1">
                                            <X size={14} /> {t('common.cancel', 'Cancel')}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4">
                                        <Avatar name={p.name} />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-white uppercase tracking-tight">{p.name || t('players.anonymous', 'Anonymous')}</h3>
                                                {p.role && p.role !== 'user' && (
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${p.role === 'superadmin' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 'border-brand/30 text-brand bg-brand/5'}`}>
                                                        {p.role}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-3 text-[10px] font-black uppercase text-zinc-500">
                                                <span>{p.played || 0} {t('players.gamesCount', '{{mode}} Games', { mode: mode })}</span>
                                                <span className={mode === '2v2' ? 'text-brand' : 'text-white'}>{t('players.winsCount', '{{count}} Wins', { count: p.won || 0 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {user?.role === 'superadmin' && !showAsManager && user.uid !== p.id && (
                                            <>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditingPlayer(p); }}
                                                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white flex items-center justify-center transition-colors"
                                                >
                                                    <Shield size={14} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePlayer(p.id); }}
                                                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                        {p.played > 0 && Math.round((p.won / p.played) * 100) >= 60 && (
                                            <Trophy size={20} className={mode === '2v2' ? 'text-brand' : 'text-white'} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}