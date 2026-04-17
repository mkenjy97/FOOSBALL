import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, getDoc, writeBatch, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Minus, Search, X, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocations } from '../context/LocationContext';
import Avatar from '../components/Avatar';
import { useTranslation } from 'react-i18next';

export default function NewMatch() {
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const { locations, userLocationIds } = useLocations();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [matchLocationId, setMatchLocationId] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal tracking
  const [modalOpen, setModalOpen] = useState(null); // 'A' or 'B' or null
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (s) =>
      setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Set default location from user profile
    const fetchUserPref = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "players", user.uid));
        if (userDoc.exists() && userDoc.data().preferredLocationId) {
          setMatchLocationId(userDoc.data().preferredLocationId);
        }
      }
    };
    fetchUserPref();

    return () => unsub();
  }, [user]);

  const saveMatch = async () => {
    if (teamA.length === 0 || teamB.length === 0) return alert(t('newMatch.bothTeams', 'Select players for both teams!'));
    if (teamA.length !== teamB.length) return alert(t('newMatch.equalTeams', 'Teams must have an equal number of players!'));
    if (!matchLocationId) return alert(t('newMatch.selectLoc', 'Please select a location for this match!'));

    setLoading(true);

    if (user.tutorialCompleted === false && user.tutorialStep === 2) {
      try {
        await updateDoc(doc(db, "players", user.uid), { tutorialCompleted: true });
        navigate('/history');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      const matchRef = doc(collection(db, "matches"));

      const allParticipants = [...teamA, ...teamB];
      const approvals = {};
      allParticipants.forEach(id => {
        if (!id.startsWith('guest:')) {
          approvals[id] = (id === user.uid); // Creator auto-approves
        }
      });

      const allApproved = Object.values(approvals).length > 0 && Object.values(approvals).every(val => val === true);

      batch.set(matchRef, {
        teamA,
        teamB,
        scoreA: score.a,
        scoreB: score.b,
        locationId: matchLocationId,
        type: teamA.length === 1 ? '1v1' : '2v2',
        winner: score.a > score.b ? 'A' : (score.b > score.a ? 'B' : 'Draw'),
        date: serverTimestamp(),
        status: allApproved ? 'confirmed' : 'pending',
        approvals,
        createdBy: user.uid
      });

      if (allApproved) {
        allParticipants.forEach(pid => {
          if (!pid.startsWith('guest:')) {
            const pRef = doc(db, "players", pid);
            const isWinner = (teamA.includes(pid) && score.a > score.b) ||
              (teamB.includes(pid) && score.b > score.a);

            batch.update(pRef, {
              matchesPlayed: increment(1),
              matchesWon: isWinner ? increment(1) : increment(0)
            });
          }
        });
      }

      // Create notifications for other participants
      allParticipants.forEach(playerId => {
        if (!playerId.startsWith('guest:') && playerId !== user.uid) {
          const notifRef = doc(collection(db, "notifications"));
          batch.set(notifRef, {
            recipientId: playerId,
            matchId: matchRef.id,
            type: 'match_record',
            status: 'unread',
            createdAt: serverTimestamp(),
            senderName: user.displayName || user.email
          });
        }
      });

      await batch.commit();
      navigate('/history');
    } catch (err) {
      console.error(err);
      alert("Error saving match. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const removePlayer = (id, team) => {
    if (team === 'A') setTeamA(prev => prev.filter(i => i !== id));
    else setTeamB(prev => prev.filter(i => i !== id));
  };

  const addPlayer = (id) => {
    if (modalOpen === 'A') setTeamA(prev => [...prev, id]);
    else if (modalOpen === 'B') setTeamB(prev => [...prev, id]);
    setModalOpen(null);
    setSearchQuery('');
  };

  const addGuestPlayer = () => {
    if (!searchQuery.trim()) return;
    const guestId = `guest:${searchQuery.trim()}`;
    addPlayer(guestId);
  };

  // Only players not in ANY team, filtered by search query
  const availablePlayers = players.filter(p =>
    !teamA.includes(p.id) &&
    !teamB.includes(p.id) &&
    p.locationIds?.includes(matchLocationId) &&
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const skipTutorial = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "players", user.uid), { tutorialCompleted: true });
    } catch (err) {
      console.error("Error skipping tutorial", err);
    }
  };

  return (
    <div className="pb-[100px] space-y-8">
      {user?.tutorialCompleted === false && user?.tutorialStep === 2 && (
        <div className="mx-4 mt-2 p-5 rounded-3xl bg-brand/10 border border-brand/30 flex flex-col gap-3 shadow-lg shadow-brand/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Plus size={64} className="text-brand" />
          </div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <h3 className="text-brand font-black uppercase tracking-tight text-xl mb-1">{t('locations.tutorial.welcome', 'Ultimo Step! 🎉')}</h3>
              <p className="text-sm font-bold text-white">
                {t('locations.tutorial.step2_alt', 'Ora registra la tua prima partita simulata! Scegli le squadre (usa il Guest per compagni/avversari non registrati) e clicca su Save Results per terminare il tutorial.')}
              </p>
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

      {/* Location Selector */}
      <div className="px-2">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={14} className="text-brand" />
          <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{t('newMatch.location', 'Match Location')}</h3>
        </div>
        <div className="relative">
          <select
            value={matchLocationId}
            onChange={(e) => setMatchLocationId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-brand/50 appearance-none"
          >
            <option value="">{t('newMatch.selectLocation', 'Select Location')}</option>
            {locations.filter(l => userLocationIds.includes(l.id)).map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
            ))}
          </select>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <ChevronRight size={20} className="rotate-90" />
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 px-2">{t('newMatch.pickTeamA', 'Pick Team A')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {teamA.map(id => {
              const isGuest = id.startsWith('guest:');
              const p = isGuest ? { id, name: id.replace('guest:', '') + ` (${t('common.guest', 'Guest')})` } : players.find(x => x.id === id);
              return (
                <div key={id} onClick={() => removePlayer(id, 'A')} className="glass p-4 rounded-2xl flex items-center gap-3 border border-brand text-white cursor-pointer hover:bg-red-500/10 hover:border-red-500/50 transition-colors group shadow-[0_0_15px_rgba(230,182,0,0.1)]">
                  {isGuest ? (
                    <div className="w-8 h-8 rounded-full bg-brand/50 text-[#070e27] flex items-center justify-center font-black flex-shrink-0">?</div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand text-[#070e27] flex items-center justify-center font-black flex-shrink-0">{p?.name?.charAt(0).toUpperCase()}</div>
                  )}
                  <span className="font-bold text-sm flex-1 truncate">{p?.name}</span>
                  <X size={16} className="text-zinc-500 group-hover:text-red-500 flex-shrink-0" />
                </div>
              )
            })}
            {teamA.length < 2 && (
              <button onClick={() => setModalOpen('A')} className="glass border-dashed border border-white/20 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-brand/50 transition-colors">
                <Plus size={20} />
                <span className="text-[10px] font-black uppercase">{t('newMatch.addPlayer', 'Add Player')}</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 px-2">{t('newMatch.pickTeamB', 'Pick Team B')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {teamB.map(id => {
              const isGuest = id.startsWith('guest:');
              const p = isGuest ? { id, name: id.replace('guest:', '') + ` (${t('common.guest', 'Guest')})` } : players.find(x => x.id === id);
              return (
                <div key={id} onClick={() => removePlayer(id, 'B')} className="glass p-4 rounded-2xl flex items-center gap-3 border border-white text-white cursor-pointer hover:bg-red-500/10 hover:border-red-500/50 transition-colors group">
                  {isGuest ? (
                    <div className="w-8 h-8 rounded-full bg-white/50 text-[#070e27] flex items-center justify-center font-black flex-shrink-0">?</div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white text-[#070e27] flex items-center justify-center font-black flex-shrink-0">{p?.name?.charAt(0).toUpperCase()}</div>
                  )}
                  <span className="font-bold text-sm flex-1 truncate">{p?.name}</span>
                  <X size={16} className="text-zinc-500 group-hover:text-red-500 flex-shrink-0" />
                </div>
              )
            })}
            {teamB.length < 2 && (
              <button onClick={() => setModalOpen('B')} className="glass border-dashed border border-white/20 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-white/50 transition-colors">
                <Plus size={20} />
                <span className="text-[10px] font-black uppercase">{t('newMatch.addPlayer', 'Add Player')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center gap-4 bg-zinc-900/50 p-10 rounded-[50px] border border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none" />

        <div className="text-center flex-1 z-10">
          <p className="text-[10px] font-black text-brand uppercase mb-2">{t('newMatch.teamA', 'Team A')}</p>
          <h2 className="text-7xl font-black text-white score-text">{score.a}</h2>
          <div className="flex gap-2 justify-center mt-4">
            <button
              disabled={teamA.length === 0 || teamB.length === 0}
              onClick={() => setScore(s => ({ ...s, a: Math.max(0, s.a - 1) }))}
              className={`w-8 h-8 rounded-full glass flex items-center justify-center transition-opacity ${teamA.length === 0 || teamB.length === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
            >
              <Minus size={14} />
            </button>
            <button
              disabled={teamA.length === 0 || teamB.length === 0}
              onClick={() => setScore(s => ({ ...s, a: s.a + 1 }))}
              className={`w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-opacity ${teamA.length === 0 || teamB.length === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="text-zinc-800 font-black text-xl z-10">VS</div>

        <div className="text-center flex-1 z-10">
          <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">{t('newMatch.teamB', 'Team B')}</p>
          <h2 className="text-7xl font-black text-white score-text">{score.b}</h2>
          <div className="flex gap-2 justify-center mt-4">
            <button
              disabled={teamA.length === 0 || teamB.length === 0}
              onClick={() => setScore(s => ({ ...s, b: Math.max(0, s.b - 1) }))}
              className={`w-8 h-8 rounded-full glass flex items-center justify-center transition-opacity ${teamA.length === 0 || teamB.length === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
            >
              <Minus size={14} />
            </button>
            <button
              disabled={teamA.length === 0 || teamB.length === 0}
              onClick={() => setScore(s => ({ ...s, b: s.b + 1 }))}
              className={`w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-opacity ${teamA.length === 0 || teamB.length === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100'}`}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: teamA.length > 0 && teamA.length === teamB.length ? 0.95 : 1 }}
        onClick={saveMatch}
        disabled={loading || teamA.length === 0 || teamA.length !== teamB.length}
        className={`w-full font-black py-6 rounded-3xl shadow-2xl flex items-center justify-center gap-2 uppercase tracking-tighter text-xl transition-all ${!loading && teamA.length > 0 && teamA.length === teamB.length
          ? 'bg-brand text-[#070e27] shadow-brand/20 opacity-100'
          : 'bg-zinc-800 text-zinc-500 shadow-none opacity-50 cursor-not-allowed'
          }`}
      >
        {loading ? t('newMatch.saving', 'Saving...') : t('newMatch.save', 'Save Results')} <ChevronRight size={24} />
      </motion.button>

      {/* --- SEARCH MODAL --- */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[100] flex flex-col bg-dark/95 backdrop-blur-xl px-6 pt-12 pb-6"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-white uppercase">
                {t('newMatch.selectTeam', 'Select Team')} {modalOpen}
              </h2>
              <button onClick={() => { setModalOpen(null); setSearchQuery(''); }} className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                <X size={24} className="text-white" />
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
              <input
                autoFocus
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.searchByName', 'Search players by name...')}
                className="w-full bg-white/5 border border-white/10 rounded-[28px] py-4 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-brand/50 transition-colors placeholder:text-zinc-600"
                autoComplete="off"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-12">
              {!matchLocationId ? (
                <div className="text-center text-zinc-500 font-bold mt-16 p-8 glass rounded-3xl">
                  {t('newMatch.selectLocFirst', 'Please select a match location first to see available players.')}
                </div>
              ) : (
                <>
                  {availablePlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addPlayer(p.id)}
                      className="w-full text-left bg-white/[0.5] backdrop-blur-md border border-white/30 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/[0.6] transition-all group"
                    >
                      <Avatar name={p.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-base tracking-tight text-zinc-900 transition-colors truncate">{p.name}</div>
                        <div className="text-[10px] text-zinc-700 font-black uppercase tracking-wider">{p.matchesPlayed || 0} {t('players.matches', 'Matches')} • {p.matchesWon || 0} {t('players.wins', 'Wins')}</div>
                      </div>
                      <Plus className="text-zinc-700 group-hover:text-brand transition-colors" size={20} />
                    </button>
                  ))}

                  {searchQuery.trim() && !availablePlayers.some(p => p.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                    <button
                      onClick={addGuestPlayer}
                      className="w-full text-left bg-brand/10 border border-brand/30 p-4 rounded-3xl flex items-center gap-4 hover:bg-brand/20 transition-all group mt-6"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand/20 text-brand flex items-center justify-center font-black flex-shrink-0">
                        ?
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-base tracking-tight text-brand transition-colors truncate">
                          {t('newMatch.addAsGuest', 'Add "{{name}}" as Guest', { name: searchQuery.trim() })}
                        </div>
                        <div className="text-[10px] text-brand/70 font-black uppercase tracking-wider">{t('newMatch.unregistered', 'Unregistered Player')}</div>
                      </div>
                      <Plus className="text-brand transition-colors" size={20} />
                    </button>
                  )}

                  {availablePlayers.length === 0 && !searchQuery.trim() && (
                    <div className="text-center text-zinc-500 font-bold mt-16 p-8 glass rounded-3xl">
                      {players.length === 0 ? t('players.noPlayers', 'No players registered in database.') : t('players.noAvailable', 'No available players found for this location.')}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}