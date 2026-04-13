import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, writeBatch, increment, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Mail, Shield, MapPin, XCircle } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useTranslation } from 'react-i18next';

export default function Notifications() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState([]);
    const [players, setPlayers] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        
        // Fetch all players for name lookup
        const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
            const pMap = {};
            snap.docs.forEach(doc => pMap[doc.id] = doc.data().name);
            setPlayers(pMap);
        });

        const q = query(collection(db, "notifications"), where("recipientId", "==", user.uid), where("status", "==", "unread"));
        const unsubNotifs = onSnapshot(q, async (snap) => {
            const notifs = [];
            for (const d of snap.docs) {
                const data = { id: d.id, ...d.data() };
                // Fetch match details for each notification
                if (data.matchId) {
                    const mSnap = await getDoc(doc(db, "matches", data.matchId));
                    if (mSnap.exists()) {
                        data.match = { id: mSnap.id, ...mSnap.data() };
                    }
                }
                notifs.push(data);
            }
            setNotifications(notifs);
            setLoading(false);
        });

        return () => {
            unsubPlayers();
            unsubNotifs();
        };
    }, [user]);

    const handleApprove = async (notif) => {
        try {
            await runTransaction(db, async (transaction) => {
                const matchRef = doc(db, "matches", notif.matchId);
                const mSnap = await transaction.get(matchRef);
                
                if (!mSnap.exists()) return;
                const match = { id: mSnap.id, ...mSnap.data() };
                
                // 1. Update approvals for this player
                const newApprovals = { ...match.approvals, [user.uid]: true };
                
                // 2. Check if everyone has approved
                const allApproved = Object.values(newApprovals).every(val => val === true);
                
                if (allApproved && match.status === 'pending') {
                    // Final Approval: Update Status and Stats
                    transaction.update(matchRef, { 
                        approvals: newApprovals,
                        status: 'confirmed' 
                    });

                    // Update Player Stats
                    const participants = [...match.teamA, ...match.teamB];
                    participants.forEach(pid => {
                        if (pid.startsWith('guest:')) return;
                        
                        const pRef = doc(db, "players", pid);
                        const isWinner = (match.teamA.includes(pid) && match.scoreA > match.scoreB) || 
                                         (match.teamB.includes(pid) && match.scoreB > match.scoreA);
                        
                        transaction.update(pRef, {
                            matchesPlayed: increment(1),
                            matchesWon: isWinner ? increment(1) : increment(0)
                        });
                    });

                    // 4. Notify the creator that the match is confirmed
                    if (match.createdBy) {
                        const notifRef = doc(collection(db, "notifications"));
                        transaction.set(notifRef, {
                            recipientId: match.createdBy,
                            matchId: match.id,
                            type: 'match_confirmed',
                            status: 'unread',
                            createdAt: serverTimestamp(),
                            senderName: 'System'
                        });
                    }
                } else {
                    // Just update approvals
                    transaction.update(matchRef, { approvals: newApprovals });
                }

                // 3. Delete notification
                transaction.delete(doc(db, "notifications", notif.id));
            });
        } catch (err) {
            console.error("Error approving match:", err);
            alert(t('notifications.approvalFailed', 'Approval failed. Please try again.'));
        }
    };

    const handleApproveManager = async (notif) => {
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, "players", notif.senderId), { role: 'manager' });
            batch.delete(doc(db, "notifications", notif.id));
            
            const systemNotifRef = doc(collection(db, "notifications"));
            batch.set(systemNotifRef, {
                recipientId: notif.senderId,
                type: 'role_updated',
                role: 'manager',
                status: 'unread',
                createdAt: serverTimestamp(),
                senderName: 'System'
            });
            await batch.commit();
        } catch (err) {
            console.error(err);
        }
    };

    const handleApproveLocation = async (notif) => {
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, "locations", notif.locationId), { status: 'confirmed' });
            batch.delete(doc(db, "notifications", notif.id));
            
            const systemNotifRef = doc(collection(db, "notifications"));
            batch.set(systemNotifRef, {
                recipientId: notif.senderId,
                type: 'location_confirmed',
                locationName: notif.locationName,
                status: 'unread',
                createdAt: serverTimestamp(),
                senderName: 'System'
            });
            await batch.commit();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDismiss = async (notifId) => {
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "notifications", notifId));
            await batch.commit();
        } catch (err) {
            console.error("Error dismissing notification:", err);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="space-y-8 pb-32">
            <div className="px-2">
                <div className="flex items-center gap-3 mb-1">
                    <Mail size={24} className="text-brand" />
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{t('notifications.title', 'Notifications')}</h2>
                </div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest pl-9">{t('notifications.subtitle', 'Match Confirmations & Alerts')}</p>
            </div>

            <div className="px-2 space-y-4">
                <AnimatePresence>
                    {notifications.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white/5 border border-white/5 rounded-[40px] p-20 text-center flex flex-col items-center gap-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-700">
                                <Mail size={32} />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black text-white uppercase text-sm">{t('notifications.allCaughtUp', 'All caught up!')}</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('notifications.noNotifications', 'No pending notifications')}</p>
                            </div>
                        </motion.div>
                    ) : (
                        notifications.map((notif) => (
                            <motion.div
                                key={notif.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="glass rounded-[32px] border border-white/10 overflow-hidden"
                            >
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {notif.type === 'manager_request' && <Shield size={12} className="text-red-500" />}
                                            {notif.type === 'location_proposal' && <MapPin size={12} className="text-brand" />}
                                            {notif.type === 'role_updated' && <Shield size={12} className="text-brand" />}
                                            {notif.type === 'location_confirmed' && <CheckCircle2 size={12} className="text-brand" />}
                                            {(notif.type === 'match_record' || notif.type === 'match_confirmation') && <Clock size={12} className="text-brand" />}
                                            {notif.type === 'match_confirmed' && <CheckCircle2 size={12} className="text-brand" />}
                                            
                                            <span className="text-[10px] font-black uppercase text-brand tracking-widest">
                                                {t(`notifications.types.${notif.type}`, notif.type.replace('_', ' '))}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                            {new Date(notif.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="py-2">
                                        {notif.type === 'manager_request' && (
                                            <p className="text-sm font-bold text-white">
                                                <span className="text-red-500">{notif.senderName}</span> {t('notifications.managerRequestMsg', 'is requesting Manager permissions to oversee location approvals.')}
                                            </p>
                                        )}
                                        {notif.type === 'location_proposal' && (
                                            <p className="text-sm font-bold text-white">
                                                <span className="text-brand">{notif.senderName}</span> {t('notifications.locationProposalMsg', 'proposed a new base: {{name}}', { name: notif.locationName })}
                                            </p>
                                        )}
                                        {notif.type === 'role_updated' && (
                                            <p className="text-sm font-bold text-white">
                                                {t('notifications.roleUpdatedMsg', 'Your request has been approved! You are now a {{role}}.', { role: notif.role })}
                                            </p>
                                        )}
                                        {notif.type === 'location_confirmed' && (
                                            <p className="text-sm font-bold text-white">
                                                {t('notifications.locationConfirmedMsg', 'Your location proposal "{{name}}" has been confirmed and is now live.', { name: notif.locationName })}
                                            </p>
                                        )}
                                        {(notif.type === 'match_record' || notif.type === 'match_confirmation') && (
                                            <p className="text-sm font-bold text-white">
                                                {t('notifications.matchInviteMsg', '{{name}} invited you to confirm a match result.', { name: notif.senderName })}
                                            </p>
                                        )}
                                        {notif.type === 'match_confirmed' && (
                                            <p className="text-sm font-bold text-white">
                                                {t('notifications.matchConfirmedMsg', 'Your match result has been confirmed by all players and is now official.')}
                                            </p>
                                        )}
                                    </div>

                                    {notif.match && (
                                        <div className="flex items-center justify-between gap-4 bg-dark/50 p-6 rounded-2xl border border-white/5">
                                            <div className="text-center flex-1">
                                                <div className="flex -space-x-2 justify-center mb-2">
                                                    {notif.match.teamA.map(id => <Avatar key={id} name={players[id]} size="sm" />)}
                                                </div>
                                                <div className="text-2xl font-black score-text">{notif.match.scoreA}</div>
                                            </div>
                                            <div className="text-zinc-700 font-black text-xs">VS</div>
                                            <div className="text-center flex-1">
                                                <div className="flex -space-x-2 justify-center mb-2">
                                                    {notif.match.teamB.map(id => <Avatar key={id} name={players[id]} size="sm" />)}
                                                </div>
                                                <div className="text-2xl font-black score-text">{notif.match.scoreB}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {notif.type === 'manager_request' && (
                                            <>
                                                <button 
                                                    onClick={() => handleApproveManager(notif)}
                                                    className="flex-1 bg-white text-dark font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-brand transition-colors"
                                                >
                                                    {t('notifications.approveManagerBtn', 'Approve Manager')}
                                                </button>
                                                <button 
                                                    onClick={() => handleDismiss(notif.id)}
                                                    className="px-6 bg-white/5 border border-white/10 text-zinc-500 rounded-2xl flex items-center justify-center hover:text-red-500"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}
                                        {notif.type === 'location_proposal' && (
                                            <>
                                                <button 
                                                    onClick={() => handleApproveLocation(notif)}
                                                    className="flex-1 bg-white text-dark font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-brand transition-colors"
                                                >
                                                    {t('notifications.confirmOfficeBtn', 'Confirm Office')}
                                                </button>
                                                <button 
                                                    onClick={() => handleDismiss(notif.id)}
                                                    className="px-6 bg-white/5 border border-white/10 text-zinc-500 rounded-2xl flex items-center justify-center hover:text-red-500"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}
                                        {(notif.type === 'role_updated' || notif.type === 'location_confirmed' || notif.type === 'match_confirmed') && (
                                            <button 
                                                onClick={() => handleDismiss(notif.id)}
                                                className="flex-1 bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-white/10 transition-colors"
                                            >
                                                {t('notifications.dismissBtn', 'Dismiss')}
                                            </button>
                                        )}
                                        {(notif.type === 'match_record' || notif.type === 'match_confirmation') && (
                                            <button 
                                                onClick={() => handleApprove(notif)}
                                                className="flex-1 bg-white text-[#070e27] font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-brand transition-colors flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 size={16} /> {t('notifications.confirmResultBtn', 'Confirm Result')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
