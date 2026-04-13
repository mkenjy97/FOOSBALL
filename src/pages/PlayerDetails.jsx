import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy, Calendar, Users, User } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useLocations } from '../context/LocationContext';
import { useTranslation } from 'react-i18next';

export default function PlayerDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { selectedLocationId, locations } = useLocations();
    const [player, setPlayer] = useState(null);
    const [matches, setMatches] = useState([]);
    const [playersMap, setPlayersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('2v2');

    const currentLocation = locations.find(l => l.id === selectedLocationId);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch Player
            const pSnap = await getDoc(doc(db, "players", id));
            if (pSnap.exists()) {
                setPlayer({ id: pSnap.id, ...pSnap.data() });
            }

            // 2. Fetch all players for name lookup in matches
            const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
                const pMap = {};
                snap.docs.forEach(d => pMap[d.id] = d.data().name);
                setPlayersMap(pMap);
            });

            // 3. Fetch Matches involving this player
            // Note: indexing constraints might prevent complex queries without composite indices, 
            // so we fetch matches where player is in either team and filter client-side.
            // For now, let's fetch matches and filter status.
            const q = query(collection(db, "matches"), orderBy("date", "desc"));
            const unsubMatches = onSnapshot(q, (snap) => {
                const mList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setMatches(mList.filter(m => m.status !== 'pending' && [...m.teamA, ...m.teamB].includes(id)));
                setLoading(false);
            });

            return () => {
                unsubPlayers();
                unsubMatches();
            };
        };

        fetchData();
    }, [id]);

    const filteredMatches = (selectedLocationId === 'all' 
        ? matches 
        : matches.filter(m => m.locationId === selectedLocationId))
        .filter(m => {
            const isType = m.type ? m.type === mode : (mode === '1v1' ? m.teamA.length === 1 : m.teamA.length === 2);
            return isType;
        });

    const stats = {
        played: filteredMatches.length,
        won: filteredMatches.filter(m => {
            const team = m.teamA.includes(id) ? 'A' : 'B';
            return m.winner === team;
        }).length,
    };
    stats.winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

    if (loading || !player) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{t('playerDetails.loading', 'Loading Player Stats')}</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <header className="flex items-center gap-4 px-2">
                <button 
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex-1">
                    <h2 className="text-[10px] font-black text-brand uppercase tracking-widest">{t('playerDetails.title', 'Player Profile')}</h2>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight truncate">{player.name}</h1>
                </div>
            </header>

            <div className="relative mx-2">
                <div className="glass p-8 rounded-[40px] border border-white/10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Trophy size={160} />
                    </div>
                    <Avatar name={player.name} size="lg" />
                    <div className="mt-6 space-y-1">
                        <p className="text-3xl font-black text-white score-text">{stats.winRate}%</p>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {t('playerDetails.winRate', 'Win Rate')} {selectedLocationId !== 'all' && t('playerDetails.inLocation', 'in {{name}}', { name: currentLocation?.name })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full mt-8 pt-8 border-t border-white/5">
                        <div>
                            <p className="text-2xl font-black text-white">{stats.played}</p>
                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{t('playerDetails.matches', 'Matches')}</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-brand">{stats.won}</p>
                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{t('playerDetails.victories', 'Victories')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-brand" />
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('playerDetails.historyTitle', 'Match History')}</h3>
                    </div>
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 scale-90">
                        <button onClick={() => setMode('2v2')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 ${mode === '2v2' ? 'bg-brand text-black shadow-lg shadow-brand/20' : 'text-zinc-500'}`}><Users size={12}/> {t('players.mode2v2', '2V2')}</button>
                        <button onClick={() => setMode('1v1')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 ${mode === '1v1' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-zinc-500'}`}><User size={12}/> {t('players.mode1v1', '1V1')}</button>
                    </div>
                </div>

                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredMatches.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12 glass rounded-[32px] border-dashed border-zinc-800"
                            >
                                <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">{t('playerDetails.noHistory', 'No matching history found')}</p>
                            </motion.div>
                        ) : (
                            filteredMatches.map((m, i) => {
                                 const isWinner = (m.teamA.includes(id) && m.scoreA > m.scoreB) || (m.teamB.includes(id) && m.scoreB > m.scoreA);
                                
                                return (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="glass p-4 rounded-3xl border border-white/5 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-10 rounded-full ${isWinner ? 'bg-brand' : 'bg-red-500/20'}`} />
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase tracking-tight">
                                                    {m.scoreA} - {m.scoreB}
                                                </p>
                                                <p className="text-[8px] font-bold text-zinc-500 uppercase">
                                                    {m.date?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex -space-x-2">
                                            {[...m.teamA, ...m.teamB].filter(pid => pid !== id).slice(0, 3).map(pid => (
                                                <Avatar key={pid} name={playersMap[pid]} size="sm" />
                                            ))}
                                            {[...m.teamA, ...m.teamB].length > 4 && (
                                                <div className="w-8 h-8 rounded-2xl bg-zinc-800 border-2 border-dark flex items-center justify-center text-[8px] font-black">+</div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
