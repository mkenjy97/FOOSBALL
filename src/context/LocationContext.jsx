import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const LocationContext = createContext();

export function LocationProvider({ children }) {
    const { user } = useAuth();
    const [locations, setLocations] = useState([]);
    const [selectedLocationId, setSelectedLocationId] = useState(localStorage.getItem('selectedLocationId') || 'all');
    const [userLocationIds, setUserLocationIds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Listen to all locations
        const unsubLocs = onSnapshot(collection(db, "locations"), (snap) => {
            const locs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLocations(locs);
            setLoading(false);
        });

        // 2. Listen to user's joined locations
        let unsubUser = () => {};
        if (user) {
            unsubUser = onSnapshot(doc(db, "players", user.uid), (snap) => {
                if (snap.exists()) {
                    setUserLocationIds(snap.data().locationIds || []);
                }
            });
        }

        return () => {
            unsubLocs();
            unsubUser();
        };
    }, [user]);

    // Sync with user preference ONLY if no local preference exists
    useEffect(() => {
        if (user && !localStorage.getItem('selectedLocationId')) {
            const fetchPrefs = async () => {
                const userDoc = await getDoc(doc(db, "players", user.uid));
                if (userDoc.exists() && userDoc.data().preferredLocationId) {
                    setSelectedLocationId(userDoc.data().preferredLocationId);
                }
            };
            fetchPrefs();
        }
    }, [user]);

    useEffect(() => {
        localStorage.setItem('selectedLocationId', selectedLocationId);
    }, [selectedLocationId]);

    const value = {
        locations,
        selectedLocationId,
        setSelectedLocationId,
        userLocationIds,
        loading
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
}

export const useLocations = () => useContext(LocationContext);
