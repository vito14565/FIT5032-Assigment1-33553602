// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Use your actual config from Firebase Console
const firebaseConfig = {
  apiKey: 'AIzaSyCGEoUInFU0NtbDsKEMZbkbVWBEK-uwoCs',
  authDomain: 'nutrition-app-45776.firebaseapp.com',
  projectId: 'nutrition-app-45776',
  storageBucket: 'nutrition-app-45776.firebasestorage.app',
  messagingSenderId: '455536026452',
  appId: '1:455536026452:web:b5d55a8e64b5a61892dec1',
  // measurementId is optional for Firestore; not required here
}

const app = initializeApp(firebaseConfig)

// 👉 export a named Firestore instance
export const db = getFirestore(app)