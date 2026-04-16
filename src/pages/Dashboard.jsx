import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';
import { Trophy, TrendingUp, Target, MapPin, ChevronRight, Clock, Award, Crown, Calendar, X } from 'lucide-react';
import { useLocations } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedLocationId, locations } = useLocations();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [player, setPlayer] = useState(null);
  const [playerNames, setPlayerNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(localStorage.getItem('hideWelcomeBanner') !== 'true');

  const currentLocation = locations.find(l => l.id === selectedLocationId);

  useEffect(() => {
    if (!user) return;

    // 1. Listen to User Data & All Players for Names
    const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
      const names = {};
      snap.docs.forEach(d => {
          names[d.id] = d.data().name;
          if (d.id === user.uid) {
              setPlayer({ id: d.id, ...d.data() });
          }
      });
      setPlayerNames(names);
    });

    // 2. Listen to Matches
    const unsubMatches = onSnapshot(query(collection(db, "matches"), orderBy("date", "desc")), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubMatches();
    };
  }, [user]);

  const confirmedMatches = matches.filter(m => m.status !== 'pending');
  const locationMatches = selectedLocationId === 'all' 
    ? confirmedMatches 
    : confirmedMatches.filter(m => m.locationId === selectedLocationId);

  const myMatches = locationMatches.filter(m => [...m.teamA, ...m.teamB].includes(user.uid));
  const lastMatch = myMatches[0];

  const stats = {
    played: myMatches.length,
    won: myMatches.filter(m => {
      const team = m.teamA.includes(user.uid) ? 'A' : 'B';
      return m.winner === team;
    }).length,
  };
  stats.winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const getLeaderships = () => {
    const leaderAwards = [];
    locations.filter(l => player?.locationIds?.includes(l.id)).forEach(loc => {
      const locMatches = confirmedMatches.filter(m => m.locationId === loc.id);
      
      ['1v1', '2v2'].forEach(mode => {
        const playerStats = {};
        locMatches.filter(m => {
          const isType = m.type ? m.type === mode : (mode === '1v1' ? m.teamA.length === 1 : m.teamA.length === 2);
          return isType;
        }).forEach(m => {
          [...m.teamA, ...m.teamB].forEach(pid => {
            if (!playerStats[pid]) playerStats[pid] = { played: 0, won: 0 };
            playerStats[pid].played++;
            const team = m.teamA.includes(pid) ? 'A' : 'B';
            if (m.winner === team) playerStats[pid].won++;
          });
        });

        const ranked = Object.entries(playerStats)
          .map(([id, s]) => ({ id, winRate: Math.round((s.won / s.played) * 100), played: s.played }))
          .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
        
        if (ranked[0]?.id === user.uid) {
          leaderAwards.push({ locationName: loc.name, mode });
        }
      });
    });
    return leaderAwards;
  };

  const myLeaderships = getLeaderships();

  if (loading || !player) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{t('common.loading', 'Syncing your stats')}</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <header className="px-2">
        <div className="flex items-center gap-2 mb-2">
            <MapPin size={10} className="text-brand" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                {selectedLocationId === 'all' ? t('dashboard.everywhere', 'Everywhere') : currentLocation?.name}
            </span>
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase transition-all">{t('dashboard.welcome', 'Welcome back, {{name}}!', { name: player.name.split(' ')[0] })}</h2>
      </header>

      {/* Friendly Welcome Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
            className="mx-2 p-6 rounded-[32px] bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 relative overflow-hidden"
          >
            <button 
                onClick={() => {
                    setShowBanner(false);
                    localStorage.setItem('hideWelcomeBanner', 'true');
                }}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors z-20"
            >
                <X size={18} />
            </button>
            <div className="relative z-10 flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-brand text-dark flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
                    <Trophy size={24} />
                </div>
                <p className="text-xs font-bold text-white leading-relaxed pr-6">
                    {t('dashboard.welcomeBanner', 'Welcome to the Global NTT Foosball League! 🏆 Track your matches across all offices and climb the rankings.')}
                </p>
            </div>
            {/* Abstract background shape */}
            <div className="absolute top--10 right--10 w-32 h-32 bg-brand/10 rounded-full blur-3xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Location Reminder */}
      {player && (!player.locationIds || player.locationIds.length === 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-2 p-6 rounded-[32px] glass border border-white/10 relative overflow-hidden flex flex-col gap-4"
          >
            <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 text-brand flex items-center justify-center shrink-0 border border-white/5">
                    <MapPin size={24} />
                </div>
                <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-sm mb-1">{t('dashboard.noLocationTitle', 'No Office Base Joined')}</h3>
                    <p className="text-[10px] font-bold text-zinc-400 leading-tight">
                        {t('dashboard.noLocationDesc', 'You haven\'t joined any offices yet. Join one to participate in local rankings and track matches.')}
                    </p>
                </div>
            </div>
            <button 
                onClick={() => navigate('/locations')}
                className="w-full bg-brand text-dark font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:shadow-[0_0_15px_rgba(230,182,0,0.3)] transition-all flex justify-center items-center gap-2"
            >
                {t('dashboard.joinOfficeBtn', 'Go to Locations')} <ChevronRight size={14} />
            </button>
          </motion.div>
      )}

      {/* Personal Key Stats */}
      <div className="grid grid-cols-2 gap-4 mx-2">
        <div className="bg-brand p-6 rounded-[40px] text-[#070e27] shadow-2xl shadow-brand/20 relative overflow-hidden">
            <Award className="absolute right-[-10px] bottom-[-10px] w-24 h-24 opacity-10 rotate-12" />
            <p className="text-[10px] font-black uppercase opacity-60 mb-2">{t('dashboard.winRate', 'Win Rate')}</p>
            <p className="text-4xl font-black tracking-tighter">{stats.winRate}%</p>
        </div>
        <div 
            onClick={() => navigate('/history', { state: { filter: 'wins' } })}
            className="glass p-6 rounded-[40px] border border-white/5 relative overflow-hidden cursor-pointer hover:border-brand/30 transition-all active:scale-95"
        >
            <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-24 h-24 opacity-5 rotate-12" />
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">{t('dashboard.wins', 'Victories')}</p>
            <p className="text-4xl font-black text-white tracking-tighter">{stats.won}</p>
        </div>
      </div>

      {/* Leadership Achievements */}
      {myLeaderships.length > 0 && (
        <div className="px-2 space-y-4">
            <div className="flex items-center gap-2">
                <Trophy size={14} className="text-brand" />
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('dashboard.personalLeading', 'Personal Leading')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {myLeaderships.map((award, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={`${award.locationName}-${award.mode}`}
                        className={`glass p-4 rounded-3xl border border-brand/20 flex items-center gap-3 pr-6 ${myLeaderships.length === 1 ? 'col-span-2' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${award.mode === '1v1' ? 'bg-white text-dark' : 'bg-brand text-dark'}`}>
                            <Crown size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-tight truncate">{t('dashboard.champion', '{{mode}} Champion', { mode: award.mode })}</p>
                            <p className="text-[8px] font-bold text-zinc-500 uppercase truncate">{award.locationName}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
      )}

      {/* Total Matches in Location - Clickable */}
      <motion.div 
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/player/${user.uid}`)}
        className="mx-2 glass p-6 rounded-[40px] border border-white/5 flex items-center justify-between group cursor-pointer hover:border-brand/30 transition-all shadow-xl"
      >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-brand">
                <Target size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('dashboard.yourGames', 'Your Games')}</p>
                <p className="text-xl font-black text-white">
                    {t('dashboard.playedInLocation', '{{count}} Played in {{location}}', { 
                        count: stats.played, 
                        location: selectedLocationId === 'all' ? t('dashboard.total', 'total') : (currentLocation?.name || '') 
                    })}
                </p>
            </div>
        </div>
        <ChevronRight size={20} className="text-zinc-600 group-hover:text-brand transition-colors" />
      </motion.div>

      {/* Last Match */}
      <div className="px-2 space-y-4">
        <div className="flex items-center gap-2">
            <Clock size={14} className="text-brand" />
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('dashboard.lastResult', 'Last Result')}</h3>
        </div>
        <AnimatePresence mode="wait">
        {lastMatch ? (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass p-6 rounded-[40px] border border-white/10 relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase">
                        <Calendar size={12} className="text-brand" />
                        {lastMatch.date?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${(lastMatch.teamA.includes(user.uid) && lastMatch.winner === 'A') || (lastMatch.teamB.includes(user.uid) && lastMatch.winner === 'B') ? 'bg-brand/20 text-brand' : 'bg-red-500/20 text-red-500'}`}>
                        {(lastMatch.teamA.includes(user.uid) && lastMatch.winner === 'A') || (lastMatch.teamB.includes(user.uid) && lastMatch.winner === 'B') ? t('dashboard.victory', 'Victory') : t('dashboard.defeat', 'Defeat')}
                    </div>
                </div>

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex-1 text-center min-w-0">
                        <div className="flex -space-x-2 justify-center mb-2">
                            {lastMatch.teamA.map(id => <Avatar key={id} name={playerNames[id]} size="sm" />)}
                        </div>
                        <p className="text-[9px] font-black text-white uppercase truncate mb-1">
                            {lastMatch.teamA.map(id => playerNames[id]?.split(' ')[0]).join(' & ')}
                        </p>
                        <p className={`text-4xl font-black ${lastMatch.winner === 'A' ? 'text-brand' : 'text-zinc-700'}`}>{lastMatch.scoreA}</p>
                    </div>
                    <div className="text-zinc-800 font-black text-xs px-2">VS</div>
                    <div className="flex-1 text-center min-w-0">
                        <div className="flex -space-x-2 justify-center mb-2">
                            {lastMatch.teamB.map(id => <Avatar key={id} name={playerNames[id]} size="sm" />)}
                        </div>
                        <p className="text-[9px] font-black text-white uppercase truncate mb-1">
                            {lastMatch.teamB.map(id => playerNames[id]?.split(' ')[0]).join(' & ')}
                        </p>
                        <p className={`text-4xl font-black ${lastMatch.winner === 'B' ? 'text-brand' : 'text-zinc-700'}`}>{lastMatch.scoreB}</p>
                    </div>
                </div>
            </motion.div>
        ) : (
            <div className="glass p-8 rounded-[40px] text-center border-dashed border-zinc-800">
                <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">{t('dashboard.noMatchesInRegion', 'No matches found in this region')}</p>
            </div>
        )}
        </AnimatePresence>
      </div>
      
      {/* Quick Action */}
      <div className="px-2">
          <button 
            onClick={() => {
                navigate('/rankings', { 
                    state: { 
                        fromDashboardGlobal: true, 
                        previousLocationId: selectedLocationId 
                    } 
                });
            }}
            className="w-full glass p-5 rounded-[32px] border border-white/5 flex items-center justify-center gap-3 group hover:bg-white/5 transition-all text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white"
          >
              <Trophy size={16} /> {t('dashboard.viewGlobalRankings', 'View Global Rankings')} <ChevronRight size={14} />
          </button>
      </div>
    </div>
  );
}