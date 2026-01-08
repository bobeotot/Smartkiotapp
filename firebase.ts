import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDR8D9oDGByMpPvFaY2a8hY0n8ZIW3e0oQ",
  authDomain: "smartkiotsusu.firebaseapp.com",
  projectId: "smartkiotsusu",
  storageBucket: "smartkiotsusu.firebasestorage.app",
  messagingSenderId: "486623085734",
  appId: "1:486623085734:web:fa64bff1d40e0793b92067"
};

const app = initializeApp(firebaseConfig);

// 🔥 CÁI QUAN TRỌNG NHẤT
export const db = getFirestore(app);
