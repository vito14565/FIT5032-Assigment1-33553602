// src/firebase.js
import { initializeApp } from 'firebase/app'
// ✅ 用 initializeFirestore，並開啟自動 long-poll 偵測 + 關閉 fetch streams
import { initializeFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCRiZcmPYGpKL8XVYMSF9bbl5Rl9a5nwI0",
  authDomain: "nutrition-app-19cd7.firebaseapp.com",
  projectId: "nutrition-app-19cd7",
  // ⚠ 建議之後把 bucket 改回 appspot.com（Storage 要用到時）
  storageBucket: "nutrition-app-19cd7.firebasestorage.app",
  messagingSenderId: "886466181962",
  appId: "1:886466181962:web:76f54e0bc8b25034b59fb3",
}

const app = initializeApp(firebaseConfig)

// 這段是重點：解 Safari 的 WebChannel / Fetch Streams 相容性
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
  // 若仍遇到問題，把上一行保留，並改成：
  // experimentalForceLongPolling: true,
  // useFetchStreams: false,
})

export const auth = getAuth(app)
export const storage = getStorage(app)
export default app