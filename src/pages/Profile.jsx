import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, updateDoc, collection, onSnapshot, query, where, limit, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, User, Target, Moon, Sun, Monitor, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { user, showAsManager, toggleShowAsManager } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [locations, setLocations] = useState([]);
  const [userLocIds, setUserLocIds] = useState([]);
  const [preferredLocId, setPreferredLocId] = useState('');
  const [stats, setStats] = useState({ v1: { played: 0, won: 0 }, v2: { played: 0, won: 0 } });
  const [hasSuperadmin, setHasSuperadmin] = useState(true);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      
      // Fetch user profile data (locations)
      const unsubUser = onSnapshot(doc(db, "players", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserLocIds(data.locationIds || []);
          setPreferredLocId(data.preferredLocationId || '');
        }
      });

      // Fetch all locations to display names
      const unsubLocs = onSnapshot(collection(db, "locations"), (snap) => {
        setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // Fetch personal stats
      const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
        const myMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(m => [...m.teamA, ...m.teamB].includes(user.uid));
        
        const v1List = myMatches.filter(m => m.type === '1v1' || (!m.type && m.teamA.length === 1));
        const v2List = myMatches.filter(m => m.type === '2v2' || (!m.type && m.teamA.length === 2));

        const calculate = (list) => ({
            played: list.length,
            won: list.filter(m => {
                const myTeam = m.teamA.includes(user.uid) ? 'A' : 'B';
                return m.winner === myTeam;
            }).length
        });

        setStats({
            v1: calculate(v1List),
            v2: calculate(v2List)
        });
      });
      
      // Check if any superadmin exists
      const qAdmin = query(collection(db, "players"), where("role", "==", "superadmin"), limit(1));
      const unsubAdminCheck = onSnapshot(qAdmin, (snap) => {
        setHasSuperadmin(!snap.empty);
      });

      return () => {
        unsubUser();
        unsubLocs();
        unsubMatches();
        unsubAdminCheck();
      };
    }
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName
      });
      await updateDoc(doc(db, 'players', user.uid), {
        name: displayName || user.email.split('@')[0],
        preferredLocationId: preferredLocId
      });
      setMessage(t('profile.updateSuccess', 'Profile updated successfully.'));
    } catch (error) {
      setMessage(t('profile.updateError', 'Failed to update profile: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestManager = async () => {
    setLoading(true);
    setMessage('');
    try {
      const q = query(collection(db, "players"), where("role", "==", "superadmin"));
      const snap = await getDocs(q);
      
      if (snap.empty) throw new Error("No superadmins found to approve your request.");

      const batch = writeBatch(db);
      snap.docs.forEach(adminDoc => {
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          recipientId: adminDoc.id,
          senderId: user.uid,
          senderName: user.name || user.email,
          type: 'manager_request',
          status: 'unread',
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      setMessage(t('profile.requestSent', 'Request sent to Superadmins.'));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAdmin = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "players", user.uid), {
        role: 'superadmin'
      });
      setMessage(t('profile.claimedSuccess', 'You are now a Superadmin.'));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const StatBox = ({ title, icon: Icon, played, won, color }) => {
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
      return (
          <div className="glass p-5 rounded-3xl flex-1 border border-white/5 relative overflow-hidden group">
              <div className={`absolute top-0 right-0 p-2 opacity-5 ${color} transition-opacity`}>
                  <Icon size={48} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className={color} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</span>
              </div>
              <div className="space-y-1">
                  <div className="flex justify-between items-end">
                      <p className="text-3xl font-black text-white leading-none">{winRate}%</p>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{t('rankings.winRate', 'Win Rate')}</p>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full ${color === 'text-brand' ? 'bg-brand' : 'bg-white'}`} style={{ width: `${winRate}%` }} />
                  </div>
                  <div className="flex justify-between pt-2">
                       <div className="text-center flex-1 border-r border-white/5">
                            <p className="text-xs font-black text-white">{played}</p>
                            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{t('history.matches', 'Games')}</p>
                       </div>
                       <div className="text-center flex-1">
                            <p className={`text-xs font-black ${color === 'text-brand' ? 'text-brand' : 'text-white'}`}>{won}</p>
                            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{t('dashboard.victories', 'Wins')}</p>
                       </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="px-2">
           <h2 className="text-2xl font-black tracking-tight uppercase">{t('profile.title', 'Your Profile')}</h2>
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('profile.subtitle', 'Personal Athlete File')}</p>
      </div>

      <div className="bg-card border border-white/5 p-8 rounded-[40px] flex flex-col items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none" />
        <div className="w-24 h-24 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center mb-2 shadow-2xl shadow-brand/10 z-10">
          <span className="text-brand text-4xl font-black">
            {displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="text-center z-10">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">{displayName || t('profile.anonymous', 'Anonymous Player')}</h3>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{user?.email}</p>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
            <div className={`w-1.5 h-1.5 rounded-full ${user?.role === 'superadmin' ? 'bg-red-500' : (user?.role === 'manager' ? 'bg-brand' : 'bg-zinc-500')}`} />
            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">
                {user?.role ? t(`players.role${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`, user.role) : t('players.roleUser', 'User')}
            </span>
          </div>
        </div>
      </div>
      
      {/* Role Management Actions */}
      {(!user?.role || user.role === 'user') && (
        <div className="px-2 -mt-2">
            {!hasSuperadmin ? (
                <button 
                    onClick={handleClaimAdmin}
                    className="w-full bg-red-600/10 border border-red-600/20 text-red-500 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                    {t('profile.claimAdmin', 'Claim Superadmin Role (System First Run)')}
                </button>
            ) : (
                <button 
                    onClick={handleRequestManager}
                    disabled={loading}
                    className="w-full bg-brand/10 border border-brand/20 text-brand font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-brand hover:text-dark transition-all flex items-center justify-center gap-2"
                >
                    {t('profile.requestManager', 'Request Management Permission')}
                </button>
            )}
        </div>
      )}

      {/* Statistics Section */}
      <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
              <Trophy size={14} className="text-brand" />
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">{t('profile.statsTitle', 'Athlete Statistics')}</h3>
          </div>
          <div className="flex gap-4">
              <StatBox 
                title={t('profile.v2Title', '2v2 Doubles')} 
                icon={Users} 
                played={stats.v2.played} 
                won={stats.v2.won} 
                color="text-brand" 
              />
              <StatBox 
                title={t('profile.v1Title', '1v1 Singles')} 
                icon={User} 
                played={stats.v1.played} 
                won={stats.v1.won} 
                color="text-white" 
              />
          </div>
      </div>

      {/* App Preferences */}
      <div className="px-2 space-y-4">
          <div className="flex items-center gap-2">
              <Monitor size={14} className="text-zinc-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">{t('profile.preferences', 'App Preferences')}</h3>
          </div>
          <div className="glass p-4 rounded-[28px] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-500'}`}>
                      {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                      <p className="text-xs font-black text-white uppercase tracking-tight">{theme === 'dark' ? t('profile.darkMode', 'Dark Mode') : t('profile.lightMode', 'Light Mode')}</p>
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{t('profile.toggleTheme', 'Toggle visual theme')}</p>
                  </div>
              </div>
              <button
                  type="button"
                  onClick={toggleTheme}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${theme === 'dark' ? 'bg-indigo-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.4)]' : 'bg-orange-400 shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]'}`}
              >
                  <motion.div
                      animate={{ x: theme === 'dark' ? 24 : 0 }}
                      className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-[#070e27]"
                  >
                      {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                  </motion.div>
              </button>
          </div>

          <div className="glass p-4 rounded-[28px] border border-white/5 flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-500/10 text-blue-500`}>
                      <span className="font-black text-sm">Aa</span>
                  </div>
                  <div>
                      <p className="text-xs font-black text-white uppercase tracking-tight">{t('profile.language', 'Language')}</p>
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{t('profile.languageSub', 'Select app language')}</p>
                  </div>
              </div>
              <select 
                  value={i18n.language?.split('-')[0] || 'en'} 
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-primary font-bold focus:outline-none focus:border-brand/50 transition-all text-xs appearance-none pr-8 bg-no-repeat bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] transition-all duration-300`}
                  style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22${theme === 'dark' ? '%23ffffff' : '%23070e27'}%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E")`
                  }}
              >
                  <option value="en" className="text-dark">English</option>
                  <option value="it" className="text-dark">Italiano</option>
                  <option value="fr" className="text-dark">Français</option>
                  <option value="es" className="text-dark">Español</option>
                  <option value="ja" className="text-dark">日本語</option>
              </select>
          </div>
      </div>

      {/* Superadmin Mode Toggle */}
      {user?.role === 'superadmin' && (
          <div className="px-2 space-y-4">
              <div className="flex items-center gap-2">
                  <Shield size={14} className="text-red-500" />
                  <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">{t('profile.adminViewTitle', 'Administrative View')}</h3>
              </div>
              <div className="glass p-4 rounded-[28px] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                          <Shield size={20} />
                      </div>
                      <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight">{t('profile.showAsManager', 'Show as Manager')}</p>
                          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{t('profile.hideAdminTools', 'Hide superadmin-only tools')}</p>
                      </div>
                  </div>
                  <button
                      type="button"
                      onClick={toggleShowAsManager}
                      className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${showAsManager ? 'bg-brand shadow-[0_0_15px_rgba(230,182,0,0.2)]' : 'bg-zinc-700'}`}
                  >
                      <motion.div
                          animate={{ x: showAsManager ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-dark"
                      >
                          <Shield size={12} className={showAsManager ? 'text-brand' : 'text-zinc-400'} />
                      </motion.div>
                  </button>
              </div>
          </div>
      )}

      <form onSubmit={handleUpdate} className="flex flex-col gap-4 mt-4 px-2">
        <div className="flex items-center gap-2">
              <Target size={14} className="text-zinc-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">{t('profile.updateTitle', 'Update Identity')}</h3>
        </div>
        
        {message && (
          <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl text-center text-xs font-black text-brand uppercase tracking-widest">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1">{t('profile.displayNameLabel', 'Athlete Display Name')}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-brand/50 transition-all placeholder:text-zinc-700"
            placeholder={t('profile.displayNameLabel', 'Athlete Display Name')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{t('profile.officeLabel', 'Primary Office Base')}</label>
            <button 
                type="button" 
                onClick={() => navigate('/locations')}
                className="text-[9px] font-black text-brand uppercase tracking-widest hover:underline"
            >
                {t('profile.manageOffices', 'Manage Offices')}
            </button>
          </div>
          <select
            value={preferredLocId}
            onChange={(e) => setPreferredLocId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-brand/50 transition-all appearance-none"
          >
            <option value="">{t('profile.selectOffice', 'Select Primary Office')}</option>
            {locations.filter(l => (l.status === 'confirmed' || !l.status) && userLocIds.includes(l.id)).map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          {userLocIds.length === 0 && (
            <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1 ml-1">
                {t('profile.noOffices', 'You haven\'t joined any offices yet. Go to Offices to join!')}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-brand text-dark font-black tracking-wider uppercase rounded-[28px] py-4 flex items-center justify-center hover:shadow-[0_0_20px_rgba(230,182,0,0.2)] transition-all disabled:opacity-50"
        >
          {loading ? t('login.processing', 'Processing...') : t('profile.syncBtn', 'Sync Profile')}
        </button>
      </form>

      <div className="mt-8 px-2">
        <button
          onClick={handleLogout}
          className="w-full bg-white/5 text-zinc-500 border border-white/5 font-black uppercase tracking-wider rounded-2xl py-4 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
        >
          {t('profile.logoutBtn', 'Terminate Session')}
        </button>
      </div>
    </div>
  );
}
