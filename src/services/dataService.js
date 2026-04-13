import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from "firebase/firestore";

export const recordMatch = async (matchData) => {
  // 1. Add Match to History
  const matchRef = await addDoc(collection(db, "matches"), {
    ...matchData,
    date: serverTimestamp(),
  });

  // 2. Update Player Stats
  const allPlayers = [...matchData.teamA, ...matchData.teamB];
  const winners = matchData.scoreA > matchData.scoreB ? matchData.teamA : matchData.teamB;

  for (const playerId of allPlayers) {
    const isWinner = winners.includes(playerId);
    const playerRef = doc(db, "players", playerId);
    
    // We update stats. Win percentage is best calculated on the frontend 
    // or via a Cloud Function, but for simplicity we store raw numbers.
    await updateDoc(playerRef, {
      matchesPlayed: increment(1),
      matchesWon: isWinner ? increment(1) : increment(0)
    });
  }
  return matchRef.id;
};