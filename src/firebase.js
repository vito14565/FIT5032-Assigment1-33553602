// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCRiZcmPYGpKL8XVYMSF9bbl5Rl9a5nwI0",
  authDomain: "nutrition-app-19cd7.firebaseapp.com",
  projectId: "nutrition-app-19cd7",
  storageBucket: "nutrition-app-19cd7.firebasestorage.app",
  messagingSenderId: "886466181962",
  appId: "1:886466181962:web:76f54e0bc8b25034b59fb3",
  // measurementId 不需要
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export default app