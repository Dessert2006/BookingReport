// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUbnvaF9I7Mo0xgqznoVCwZVbqD0-STkk",
  authDomain: "dashboardapp-97bd8.firebaseapp.com",
  projectId: "dashboardapp-97bd8",
  storageBucket: "dashboardapp-97bd8.appspot.com",   // small mistake fixed here 👆
  messagingSenderId: "308712627300",
  appId: "1:308712627300:web:45d94fdb1846b5dbebd371",
  measurementId: "G-610MMDS93X"    // Optional, can ignore for now
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);   // 🔥 Firestore database

export { db };
