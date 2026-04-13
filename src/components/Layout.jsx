import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, History, Plus, MapPin, Globe, Mail, Trophy, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocations } from '../context/LocationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function Layout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { locations, selectedLocationId, setSelectedLocationId, userLocationIds } = useLocations();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [is1v1Leader, setIs1v1Leader] = useState(false);
  const [is2v2Leader, setIs2v2Leader] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Notifications listener
    const qNotifs = query(collection(db, "notifications"), where("recipientId", "==", user.uid), where("status", "==", "unread"));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => setUnreadCount(snap.size));

    // Leadership listener
    const unsubMatches = onSnapshot(collection(db, "matches"), (matchSnap) => {
      const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.status !== 'pending');
      const locMatches = (selectedLocationId === 'all' ? matches : matches.filter(m => m.locationId === selectedLocationId));

      const checkLeader = (mode) => {
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

        return ranked[0]?.id === user.uid;
      };

      setIs1v1Leader(checkLeader('1v1'));
      setIs2v2Leader(checkLeader('2v2'));
    });

    return () => {
      unsubNotifs();
      unsubMatches();
    };
  }, [user, selectedLocationId]);

  useEffect(() => {
    setShowLocationPicker(false);
  }, [location.pathname]);

  // Filter locations to only show those the user has joined and are confirmed
  const enrolledLocations = locations.filter(l => (l.status === 'confirmed' || !l.status) && userLocationIds.includes(l.id));

  const navItems = [
    { path: '/', icon: <LayoutDashboard />, label: t('nav.home', 'Home') },
    { path: '/rankings', icon: <Trophy />, label: t('nav.rankings', 'Rankings') },
    { path: '/history', icon: <History />, label: t('nav.history', 'History') },
    { path: '/players', icon: <Users />, label: t('nav.players', 'Players') },
    { path: '/locations', icon: <MapPin />, label: t('nav.locations', 'Offices') },
  ];

  return (
    <div className="min-h-screen bg-dark text-white pb-24">
      <header className="p-4 border-b border-white/10 flex flex-col gap-2 sticky top-0 bg-dark/80 backdrop-blur-md z-[1001]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img 
              src={theme === 'dark' ? "/ntt-logo.svg" : "/ntt-logo-blue.svg"} 
              alt="NTT" 
              className="h-8 opacity-90 transition-all duration-300" 
            />
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase leading-none">FOOSBALL</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/notifications" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors relative">
              <Mail size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-dark rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-black text-white">{unreadCount}</span>
                </span>
              )}
            </Link>
            {location.pathname !== '/locations' && location.pathname !== '/notifications' && location.pathname !== '/profile' && (
              <button
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${showLocationPicker ? 'bg-brand text-dark' : 'bg-white/5 text-zinc-500 hover:text-white border border-white/10'}`}
              >
                <Globe size={18} />
              </button>
            )}
            <Link to="/profile" className="w-9 h-9 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center hover:bg-brand/20 transition-colors relative">
              <span className="text-brand text-sm font-black">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : '')}
              </span>
              {is1v1Leader && (
                <Crown
                  size={14}
                  className="absolute -top-2.5 right-[2px] text-white fill-white rotate-[25deg] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]"
                />
              )}
              {is2v2Leader && (
                <Crown
                  size={14}
                  className="absolute -top-2.5 left-[2px] text-brand fill-brand rotate-[-25deg] drop-shadow-[0_0_3px_rgba(230,182,0,0.5)]"
                />
              )}
            </Link>
          </div>
        </div>

        <AnimatePresence>
          {showLocationPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="relative pb-2">
                <select
                  value={selectedLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                    setShowLocationPicker(false);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white focus:outline-none focus:border-brand/50 appearance-none shadow-2xl"
                >
                  <option value="all">{t('common.globalView', 'Global View (All Offices)')}</option>
                  {enrolledLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-[calc(50%-4px)] pointer-events-none text-zinc-500">
                  <MapPin size={14} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="p-4 max-w-md mx-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-white/5 px-8 py-4 flex justify-between items-center z-[1001]">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center ${location.pathname === item.path ? 'text-brand' : 'text-zinc-500'}`}>
            {item.icon}
            <span className="text-[10px] mt-1 font-bold uppercase">{item.label}</span>
          </Link>
        ))}
      </nav>
      {location.pathname !== '/new-match' && (
        <Link to="/new-match" className="fixed bottom-24 right-6 bg-brand text-dark p-4 rounded-full shadow-lg shadow-brand/20 z-[1001]">
          <Plus size={28} strokeWidth={3} />
        </Link>
      )}
    </div>
  );
}