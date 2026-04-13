import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';
import { Trophy, TrendingUp, Target, Users, User, MapPin } from 'lucide-react';
import { useLocations } from '../context/LocationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Rankings() {
  const location = useLocation();
  const { t } = useTranslation();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [mode, setMode] = useState('2v2'); // '2v2' or '1v1'
  const [loading, setLoading] = useState(true);
  const { selectedLocationId, setSelectedLocationId, locations } = useLocations();
  const currentLocation = locations.find(l => l.id === selectedLocationId);
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.fromDashboardGlobal) {
      const prevId = location.state.previousLocationId;
      setSelectedLocationId('all');
      return () => {
        setSelectedLocationId(prevId);
      };
    }
  }, [location.state, setSelectedLocationId]);

  useEffect(() => {
    // 1. Listen to Players
    const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Listen to Matches for dynamic stats
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubMatches();
    };
  }, []);

  const filteredMatches = (selectedLocationId === 'all' 
    ? matches 
    : matches.filter(m => m.locationId === selectedLocationId))
    .filter(m => m.status !== 'pending');

  // Calculate stats per player based on mode
  const getRankedPlayers = () => {
    return players
      .map(player => {
        const modeMatches = filteredMatches.filter(m => {
            const isType = m.type ? m.type === mode : (mode === '1v1' ? m.teamA.length === 1 : m.teamA.length === 2);
            return isType && [...m.teamA, ...m.teamB].includes(player.id);
        });

        const played = modeMatches.length;
        const won = modeMatches.filter(m => {
            const team = m.teamA.includes(player.id) ? 'A' : 'B';
            return m.winner === team;
        }).length;

        const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
        return { ...player, played, won, winRate };
      })
      .filter(p => p.played > 0) // Only show players who played in this mode
      .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
  };

  const rankedPlayers = getRankedPlayers();
  const topPlayer = rankedPlayers[0];

  if (loading) return null;

  return (
    <div className="space-y-8 pb-10">
      <div className="px-2 flex items-center gap-2">
          <MapPin size={10} className="text-brand" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              {t('common.viewing', 'Viewing')}: {selectedLocationId === 'all' ? t('common.allLocations', 'All Locations') : (currentLocation?.name || t('common.loading', 'Loading...'))}
          </span>
      </div>

      <div className="px-2">
          <h2 className="text-3xl font-black text-white tracking-tighter">{t('rankings.title', 'LEADERBOARD')}</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{t('rankings.subtitle', 'Global Rankings')}</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 mx-2">
        <button 
          onClick={() => setMode('2v2')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black tracking-tighter transition-all ${mode === '2v2' ? 'bg-brand text-dark shadow-lg shadow-brand/20' : 'text-zinc-500 hover:text-white'}`}
        >
          <Users size={18} /> {t('rankings.mode2v2Label', '2V2 MODE')}
        </button>
        <button 
          onClick={() => setMode('1v1')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black tracking-tighter transition-all ${mode === '1v1' ? 'bg-white text-dark shadow-lg shadow-white/20' : 'text-zinc-500 hover:text-white'}`}
        >
          <User size={18} /> {t('rankings.mode1v1Label', '1V1 MODE')}
        </button>
      </div>

      {/* Featured MVP Card */}
      <AnimatePresence mode="wait">
        {topPlayer ? (
          <motion.div
            key={`${mode}-${topPlayer.id}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={() => navigate(`/player/${topPlayer.id}`)}
            className={`relative overflow-hidden p-8 rounded-[40px] text-black shadow-2xl transition-colors duration-500 cursor-pointer active:scale-95 ${mode === '2v2' ? 'bg-brand shadow-brand/20' : 'bg-white shadow-white/20'}`}
          >
            <Trophy className="absolute right-[-10px] bottom-[-10px] w-40 h-40 opacity-10 rotate-12" />
            <div className="relative z-10">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">
                {t('rankings.mvpLabel', '{{mode}} Leaderboard MVP', { mode: mode })}
              </h2>
              <p className="text-5xl font-black tracking-tighter leading-none mb-4 truncate">{topPlayer.name}</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase opacity-60">{t('rankings.winRateLabel', 'Win Rate')}</p>
                  <p className="text-2xl font-black">{topPlayer.winRate}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase opacity-60">{t('rankings.victoriesLabel', 'Victories')}</p>
                  <p className="text-2xl font-black">{topPlayer.won}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="glass p-10 rounded-[40px] text-center border-dashed border-zinc-800 mx-2">
            <p className="text-zinc-500 font-black uppercase text-sm">{t('rankings.noMatches', 'No {{mode}} matches recorded', { mode: mode })}</p>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4 mx-2">
        <div className="glass p-5 rounded-[32px] flex items-center gap-3">
          <TrendingUp className={mode === '2v2' ? 'text-brand' : 'text-white'} size={20} />
          <div>
            <p className="text-[8px] font-black text-zinc-500 uppercase">{t('rankings.leagueSize', 'League Size')}</p>
            <p className="text-sm font-bold text-white">{t('rankings.playersCount', '{{count}} Players', { count: players.length })}</p>
          </div>
        </div>
        <div className="glass p-5 rounded-[32px] flex items-center gap-3">
          <Target className={mode === '2v2' ? 'text-brand' : 'text-white'} size={20} />
          <div>
            <p className="text-[8px] font-black text-zinc-500 uppercase">{t('rankings.totalBattles', 'Total Battles')}</p>
            <p className="text-sm font-bold text-white">{filteredMatches.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-sm font-black text-zinc-500 px-4 tracking-widest uppercase flex items-center justify-between">
            {t('rankings.rankingsTitle', '{{mode}} Rankings', { mode: mode })}
            <span className="text-[10px] opacity-50 not-italic">{t('rankings.activeCount', '{{count}} Active', { count: rankedPlayers.length })}</span>
          </h3>
          <div className="px-2 space-y-3">
            <AnimatePresence mode="popLayout">
            {rankedPlayers.map((p, i) => (
                <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                key={p.id}
                onClick={() => navigate(`/player/${p.id}`)}
                className="glass p-4 rounded-[28px] flex items-center justify-between group active:scale-95 transition-transform border border-white/5 cursor-pointer hover:border-brand/30"
                >
                <div className="flex items-center gap-4">
                    <span className="text-zinc-700 font-black text-xl w-6">{(i + 1).toString().padStart(2, '0')}</span>
                    <Avatar name={p.name} />
                    <div>
                    <p className="font-black text-white uppercase tracking-tight">{p.name}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">{t('rankings.matchesCount', '{{count}} Matches', { count: p.played })}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-black ${mode === '2v2' ? 'text-brand' : 'text-white'}`}>{p.winRate}%</p>
                    <div className="w-16 h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full ${mode === '2v2' ? 'bg-brand' : 'bg-white'}`} style={{ width: `${p.winRate}%` }} />
                    </div>
                </div>
                </motion.div>
            ))}
            </AnimatePresence>
          </div>
      </div>
    </div>
  );
}
