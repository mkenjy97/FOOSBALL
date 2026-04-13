import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB0vu0vbkKdUz5gx5bEPXliOFK7Ww7D2X4",
  authDomain: "nttfoosball.firebaseapp.com",
  projectId: "nttfoosball",
  storageBucket: "nttfoosball.firebasestorage.app",
  messagingSenderId: "36407992830",
  appId: "1:36407992830:web:a062a5cf061de22da6e0af",
  measurementId: "G-R9ZHPBMBKP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);