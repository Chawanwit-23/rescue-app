import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCiUYuGveDtyySIcX3aYoskQDw8PoTbPR8",
  authDomain: "flood-rescue-ai.firebaseapp.com",
  projectId: "flood-rescue-ai",
  storageBucket: "flood-rescue-ai.firebasestorage.app",
  messagingSenderId: "847062213330",
  appId: "1:847062213330:web:5c6af3bb8e5bf92c90830b",
  measurementId: "G-4Z8DMG10ZM"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);