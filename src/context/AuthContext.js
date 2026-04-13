import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Listen to player profile for roles
        unsubProfile = onSnapshot(doc(db, "players", u.uid), (snap) => {
          if (snap.exists()) {
            // merge auth user with firestore profile data (role, name, etc)
            setUser({ ...u, ...snap.data(), uid: u.uid });
          } else {
            setUser(u);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const [showAsManager, setShowAsManager] = useState(localStorage.getItem('showAsManager') === 'true');

  const toggleShowAsManager = () => {
    const newVal = !showAsManager;
    setShowAsManager(newVal);
    localStorage.setItem('showAsManager', newVal);
  };

  return (
    <AuthContext.Provider value={{ user, loading, showAsManager, toggleShowAsManager }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);