
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

// Cấu hình Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyDR8D9oDGByMpPvFaY2a8hY0n8ZIW3e0oQ",
  authDomain: "smartkiotsusu.firebaseapp.com",
  projectId: "smartkiotsusu",
  storageBucket: "smartkiotsusu.firebasestorage.app",
  messagingSenderId: "486623085734",
  appId: "1:486623085734:web:fa64bff1d40e0793b92067"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Sử dụng initializeFirestore thay vì getFirestore để cấu hình các tùy chọn nâng cao.
 * experimentalForceLongPolling: true giúp vượt qua các lỗi timeout do firewall hoặc 
 * môi trường mạng không hỗ trợ gRPC/WebSockets.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
