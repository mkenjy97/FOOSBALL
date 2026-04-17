import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const { theme } = useTheme();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    
    const from = location.state?.from?.pathname + (location.state?.from?.search || '') || '/';

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Automatically create the dedicated player document attached to this UID
                await setDoc(doc(db, 'players', userCredential.user.uid), {
                    name: email.split('@')[0], // default to email prefix
                    matchesPlayed: 0,
                    matchesWon: 0,
                    tutorialCompleted: false,
                    tutorialStep: 1
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            navigate(from, { replace: true });
        } catch (err) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError(t('login.errorInvalid', 'Invalid email or password.'));
            } else if (err.code === 'auth/email-already-in-use') {
                setError(t('login.errorInUse', 'Email is already in use.'));
            } else if (err.code === 'auth/weak-password') {
                setError(t('login.errorWeak', 'Password should be at least 6 characters.'));
            } else {
                setError(err.message || t('login.errorGeneric', 'Authentication error occurred.'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark text-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3 pt-4">
                        <img 
                            src={theme === 'dark' ? "/ntt-logo.svg" : "/ntt-logo-blue.svg"} 
                            alt="NTT" 
                            className={`h-8 opacity-90 transition-all duration-300 ${theme === 'dark' ? 'brightness-0 invert' : ''}`} 
                        />
                        <h1 className="text-4xl font-black tracking-tighter text-white uppercase mt-1">FOOSBALL</h1>
                    </div>
                    <p className="text-zinc-400 text-sm mt-2">{isSignUp ? t('login.createSubtitle', 'Create a new account') : t('login.signSubtitle', 'Sign in to track your matches')}</p>
                </div>

                <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-500 text-sm font-semibold text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">{t('login.emailLabel', 'Email Address')}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-card border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-colors"
                            placeholder="player@nttdata.com"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">{t('login.passwordLabel', 'Password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-card border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 bg-brand text-dark font-black tracking-wider uppercase rounded-2xl py-3 flex items-center justify-center hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('login.processing', 'Processing...') : isSignUp ? t('login.createBtn', 'Create Account') : t('login.enterBtn', 'Enter Arena')}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-brand transition-colors text-center font-semibold mt-2"
                    >
                        {isSignUp ? t('login.switchToSignIn', 'Already have an account? Sign In') : t('login.switchToSignUp', "Don't have an account? Sign Up")}
                    </button>
                </form>
            </div>
        </div>
    );
}
