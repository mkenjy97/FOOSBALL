import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Trophy, Users, Search, X, ChevronRight, User, MapPin, Trash2 } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useLocations } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function History() {
    const { user, showAsManager } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();
    const [matches, setMatches] = useState([]);
    const [players, setPlayers] = useState({}); // Stores players as { id: name }
    const [playersList, setPlayersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('2v2');
    const { selectedLocationId, locations } = useLocations();
    const currentLocation = locations.find(l => l.id === selectedLocationId);
    
    // Filter State
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [showOnlyWins, setShowOnlyWins] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMatch, setSelectedMatch] = useState(null);

    useEffect(() => {
        if (location.state?.filter === 'wins' && user) {
            setSelectedPlayerId(user.uid);
            setShowOnlyWins(true);
        }
    }, [location.state, user]);

    useEffect(() => {
        // 1. Listen to Players
        const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
            const pMap = {};
            const pList = [];
            snap.docs.forEach(doc => {
                const data = doc.data();
                pMap[doc.id] = data.name;
                pList.push({ id: doc.id, ...data });
            });
            setPlayers(pMap);
            setPlayersList(pList);
        });

        // 2. Listen to Matches
        const q = query(collection(db, "matches"), orderBy("date", "desc"));
        const unsubMatches = onSnapshot(q, (snap) => {
            const mList = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMatches(mList);
            setLoading(false);
        });

        return () => {
            unsubPlayers();
            unsubMatches();
        };
    }, []);

    const renderTeamNames = (teamIds) => {
        return teamIds.map(id => {
            if (id.startsWith('guest:')) {
                return id.replace('guest:', '') + ` (${t('common.guest', 'Guest')})`;
            }
            return players[id] || "Unknown";
        }).join(" & ");
    };

    const getPlayerName = (id) => {
        if (id.startsWith('guest:')) return id.replace('guest:', '');
        return players[id] || 'Unknown';
    };

    const getLocation = (locationId) => {
        return locations.find(l => l.id === locationId);
    };

    const filteredMatches = matches.filter(match => {
        const isLoc = selectedLocationId === 'all' || match.locationId === selectedLocationId;
        if (!isLoc) return false;
        const isType = match.type ? match.type === mode : (mode === '1v1' ? match.teamA.length === 1 : match.teamA.length === 2);
        if (!isType) return false;
        if (match.status === 'pending') return false;
        if (!selectedPlayerId) return true;
        
        const isParticipant = [...match.teamA, ...match.teamB].includes(selectedPlayerId);
        if (!isParticipant) return false;

        if (showOnlyWins) {
            const team = match.teamA.includes(selectedPlayerId) ? 'A' : 'B';
            return match.winner === team;
        }

        return true;
    });

    const handleDeleteMatch = async (match) => {
        if (!window.confirm(t('history.deleteConfirm', 'Delete this match? Stats will be reverted for all players.'))) return;
        
        try {
            const batch = writeBatch(db);
            // Revert stats if confirmed
            if (match.status === 'confirmed') {
                const participants = [...match.teamA, ...match.teamB];
                participants.forEach(pid => {
                    if (pid.startsWith('guest:')) return;
                    
                    const pRef = doc(db, "players", pid);
                    const isWinner = (match.teamA.includes(pid) && match.scoreA > match.scoreB) || 
                                     (match.teamB.includes(pid) && match.scoreB > match.scoreA);
                    
                    batch.update(pRef, {
                        matchesPlayed: increment(-1),
                        matchesWon: isWinner ? increment(-1) : increment(0)
                    });
                });
            }
            // Delete the match
            batch.delete(doc(db, "matches", match.id));
            await batch.commit();
        } catch (err) {
            console.error("Error deleting match:", err);
        }
    };

    const clearFilters = () => {
        setSelectedPlayerId(null);
        setShowOnlyWins(false);
    };

    const availablePlayers = playersList.filter(p => 
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{t('common.loading', 'Loading...')}</p>
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
                    <h2 className="text-3xl font-black text-white tracking-tighter text-brand">{t('history.title', 'History').toUpperCase()}</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{t('history.subtitle', 'MATCH RECORDS')}</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black leading-none text-brand">{filteredMatches.length}</p>
                    <p className="text-zinc-500 text-[10px] font-black uppercase mt-1 tracking-widest">{t('history.matches', 'Matches')}</p>
                </div>
            </div>

            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 mx-2">
                <button 
                onClick={() => setMode('2v2')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black tracking-tighter transition-all ${mode === '2v2' ? 'bg-brand text-[#070e27] shadow-lg shadow-brand/20' : 'text-zinc-500 hover:text-white'}`}
                >
                <Users size={18} /> 2V2 MODE
                </button>
                <button 
                onClick={() => setMode('1v1')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black tracking-tighter transition-all ${mode === '1v1' ? 'bg-white text-[#070e27] shadow-lg shadow-white/20' : 'text-zinc-500 hover:text-white'}`}
                >
                <User size={18} /> 1V1 MODE
                </button>
            </div>

            <div className="px-2">
                {!selectedPlayerId ? (
                    <button 
                        onClick={() => setModalOpen(true)}
                        className="w-full glass border border-white/10 rounded-2xl py-4 px-6 flex items-center justify-between text-zinc-400 hover:text-white hover:border-brand/40 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Search size={18} className="text-zinc-500 group-hover:text-brand" />
                            <span className="font-bold text-sm">{t('history.filterBy', 'Filter by player...')}</span>
                        </div>
                        <div className="text-[10px] uppercase font-black tracking-widest opacity-50">{t('common.select', 'Select')}</div>
                    </button>
                ) : (
                    <div className="glass border border-brand/50 rounded-2xl p-3 flex items-center gap-3 shadow-[0_0_15px_rgba(230,182,0,0.1)]">
                        <Avatar name={players[selectedPlayerId]} size="sm" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-brand uppercase leading-none mb-1">
                                {showOnlyWins ? t('history.winsOnly', 'Showing Your Wins') : t('history.filterBy', 'Filtering by')}
                            </p>
                            <p className="text-sm font-bold text-white truncate">{players[selectedPlayerId]}</p>
                        </div>
                        <button 
                            onClick={clearFilters}
                            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {filteredMatches.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-20 glass rounded-[40px] border-dashed border-zinc-800 mx-2"
                        >
                            <Users size={48} className="mx-auto text-zinc-800 mb-4" />
                            <p className="text-zinc-600 font-bold uppercase text-xs tracking-widest">{t('history.noMatchesByType', 'No {{mode}} Matches Found', { mode: mode })}</p>
                        </motion.div>
                    ) : (
                        filteredMatches.map((match, i) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={match.id}
                                onClick={() => setSelectedMatch(match)}
                                className="glass rounded-[32px] overflow-hidden border border-white/5 relative mx-2 cursor-pointer hover:border-white/20 transition-colors"
                            >
                                <div className="flex justify-between items-center p-4 bg-white/5 border-b border-white/5">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase">
                                        <Calendar size={12} className="text-brand" />
                                        {match.date?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${match.winner === 'A' ? 'bg-brand text-black shadow-lg shadow-brand/30' : (match.winner === 'B' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400')
                                            }`}>
                                            {match.winner === 'Draw' ? t('history.draw', 'Draw') : t('history.winner', 'Winner: Team {{winner}}', { winner: match.winner })}
                                        </div>
                                        {user?.role === 'superadmin' && !showAsManager && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                                                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 flex justify-between items-center relative">
                                    <div className="flex-1 text-center">
                                        <div className="flex justify-center -space-x-2 mb-3">
                                            {match.teamA.map(id => (
                                                <Avatar key={id} name={players[id]} size="sm" />
                                            ))}
                                        </div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight line-clamp-1">
                                            {renderTeamNames(match.teamA)}
                                        </p>
                                        <p className={`text-4xl font-black mt-2 ${match.winner === 'A' ? 'text-brand' : 'text-zinc-700'}`}>
                                            {match.scoreA}
                                        </p>
                                    </div>

                                    <div className="px-4 text-zinc-800 font-black text-xl">VS</div>

                                    <div className="flex-1 text-center">
                                        <div className="flex justify-center -space-x-2 mb-3">
                                            {match.teamB.map(id => (
                                                <Avatar key={id} name={players[id]} size="sm" />
                                            ))}
                                        </div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight line-clamp-1">
                                            {renderTeamNames(match.teamB)}
                                        </p>
                                        <p className={`text-4xl font-black mt-2 ${match.winner === 'B' ? 'text-brand' : 'text-zinc-700'}`}>
                                            {match.scoreB}
                                        </p>
                                    </div>
                                </div>

                                <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                                    <Trophy size={80} />
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* --- SELECTION MODAL --- */}
            <AnimatePresence>
                {modalOpen && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed inset-0 z-[100] flex flex-col bg-dark/95 backdrop-blur-xl px-6 pt-12 pb-6"
                >
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase">{t('history.filterTitle', 'Filter matches')}</h2>
                            <p className="text-brand text-[10px] font-black uppercase tracking-widest mt-1">{t('common.selectAnyPlayer', 'Select any player')}</p>
                        </div>
                        <button onClick={() => { setModalOpen(false); setSearchQuery(''); }} className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                            <X size={24} className="text-white" />
                        </button>
                    </div>
                    
                    <div className="relative mb-6">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
                        <input 
                            autoFocus
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('common.searchByName', 'Search by name...')}
                            className="w-full bg-card border border-white/10 rounded-[32px] py-5 pl-16 pr-6 text-white font-bold focus:outline-none focus:border-brand/50 transition-colors"
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-12">
                        {availablePlayers.length === 0 ? (
                            <div className="text-center text-zinc-500 font-bold mt-16 p-8 glass rounded-3xl">
                                {t('common.noPlayersFound', 'No players found.')}
                            </div>
                        ) : (
                            availablePlayers.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => { setSelectedPlayerId(p.id); setModalOpen(false); setSearchQuery(''); }} 
                                className="w-full text-left glass p-5 rounded-3xl flex items-center gap-5 hover:bg-white/5 hover:border-white/20 transition-all group"
                            >
                                <Avatar name={p.name} />
                                <div className="flex-1">
                                    <div className="font-black text-lg tracking-tight text-white group-hover:text-brand transition-colors">{p.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">{p.matchesPlayed || 0} {t('players.matches', 'Matches')}</div>
                                </div>
                                <ChevronRight size={20} className="text-zinc-700 group-hover:text-brand transition-colors" />
                            </button>
                            ))
                        )}
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

            {/* --- MATCH DETAIL MODAL --- */}
            <AnimatePresence>
                {selectedMatch && (() => {
                    const m = selectedMatch;
                    const loc = getLocation(m.locationId);
                    const isWinA = m.winner === 'A';
                    const isWinB = m.winner === 'B';
                    const isDraw = m.winner === 'Draw';
                    return (
                        <motion.div
                            key="match-detail"
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="fixed inset-0 z-[110] flex flex-col bg-dark/98 backdrop-blur-2xl px-6 pt-12 pb-8 overflow-y-auto no-scrollbar"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <p className="text-brand text-[10px] font-black uppercase tracking-widest">{t('history.detail', 'Match Detail')}</p>
                                    <h2 className="text-3xl font-black text-white uppercase leading-none mt-1">
                                        {m.type ? m.type.toUpperCase() : t('common.match', 'Match')}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setSelectedMatch(null)}
                                    className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X size={24} className="text-white" />
                                </button>
                            </div>

                            {/* Meta info */}
                            <div className="flex flex-wrap items-center gap-4 mb-8">
                                <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase">
                                    <Calendar size={12} className="text-brand" />
                                    {m.date?.toDate().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                {loc && (
                                    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase">
                                        <MapPin size={12} className="text-brand" />
                                        {loc.name}
                                    </div>
                                )}
                            </div>

                            {/* Teams */}
                            <div className="space-y-4 mb-8">
                                {/* Team A */}
                                <div className={`rounded-[28px] p-6 border transition-all ${isWinA ? 'border-brand/50 bg-brand/5 shadow-lg shadow-brand/10' : isDraw ? 'border-white/10 bg-white/5 opacity-70' : 'border-white/5 bg-white/[0.02] opacity-40'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('newMatch.teamA', 'Team A')}</span>
                                            {isWinA && (
                                                <div className="flex items-center gap-1 bg-brand text-[#070e27] text-[8px] font-black uppercase px-2 py-1 rounded-full">
                                                    <Trophy size={8} />
                                                    {t('history.winnerLabel', 'Winner')}
                                                </div>
                                            )}
                                            {isDraw && <span className="text-[8px] font-black uppercase px-2 py-1 rounded-full bg-zinc-700 text-zinc-300">{t('history.draw', 'Draw')}</span>}
                                        </div>
                                        <span className={`text-5xl font-black ${isWinA ? 'text-brand' : 'text-zinc-600'}`}>{m.scoreA}</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {m.teamA.map(id => {
                                            const isGuest = id.startsWith('guest:');
                                            const name = getPlayerName(id);
                                            return (
                                                <div key={id} className="flex items-center gap-3">
                                                    {isGuest ? (
                                                        <div className="w-10 h-10 rounded-2xl bg-white/10 text-zinc-400 flex items-center justify-center font-black text-sm border border-white/10 rotate-3">
                                                            <span className="-rotate-3">?</span>
                                                        </div>
                                                    ) : (
                                                        <Avatar name={name} size="sm" />
                                                    )}
                                                    <div>
                                                        <p className="font-black text-white text-sm">{name}</p>
                                                        {isGuest && <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{t('common.guest', 'Guest')}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="text-center text-zinc-700 font-black text-sm uppercase tracking-widest">{t('common.vs', 'VS')}</div>

                                {/* Team B */}
                                <div className={`rounded-[28px] p-6 border transition-all ${isWinB ? 'border-white/50 bg-white/5 shadow-lg shadow-white/5' : isDraw ? 'border-white/10 bg-white/5 opacity-70' : 'border-white/5 bg-white/[0.02] opacity-40'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('newMatch.teamB', 'Team B')}</span>
                                            {isWinB && (
                                                <div className="flex items-center gap-1 bg-white text-[#070e27] text-[8px] font-black uppercase px-2 py-1 rounded-full">
                                                    <Trophy size={8} />
                                                    {t('history.winnerLabel', 'Winner')}
                                                </div>
                                            )}
                                            {isDraw && <span className="text-[8px] font-black uppercase px-2 py-1 rounded-full bg-zinc-700 text-zinc-300">{t('history.draw', 'Draw')}</span>}
                                        </div>
                                        <span className={`text-5xl font-black ${isWinB ? 'text-white' : 'text-zinc-600'}`}>{m.scoreB}</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {m.teamB.map(id => {
                                            const isGuest = id.startsWith('guest:');
                                            const name = getPlayerName(id);
                                            return (
                                                <div key={id} className="flex items-center gap-3">
                                                    {isGuest ? (
                                                        <div className="w-10 h-10 rounded-2xl bg-white/10 text-zinc-400 flex items-center justify-center font-black text-sm border border-white/10 rotate-3">
                                                            <span className="-rotate-3">?</span>
                                                        </div>
                                                    ) : (
                                                        <Avatar name={name} size="sm" />
                                                    )}
                                                    <div>
                                                        <p className="font-black text-white text-sm">{name}</p>
                                                        {isGuest && <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{t('common.guest', 'Guest')}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Delete button for superadmin */}
                            {user?.role === 'superadmin' && !showAsManager && (
                                <button
                                    onClick={() => { handleDeleteMatch(m); setSelectedMatch(null); }}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                >
                                    <Trash2 size={14} />
                                    {t('common.deleteMatch', 'Delete Match')}
                                </button>
                            )}
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}