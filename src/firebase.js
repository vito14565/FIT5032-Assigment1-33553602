// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'   // ✅ 新增 Storage

const firebaseConfig = {
  apiKey: "AIzaSyCRiZcmPYGpKL8XVYMSF9bbl5Rl9a5nwI0",
  authDomain: "nutrition-app-19cd7.firebaseapp.com",
  projectId: "nutrition-app-19cd7",
  storageBucket: "nutrition-app-19cd7.firebasestorage.app", // ✅ 修正這裡
  messagingSenderId: "886466181962",
  appId: "1:886466181962:web:76f54e0bc8b25034b59fb3",
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)          // ✅ 匯出 Storage
export default app