import { ref, onMounted } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const user = ref(null)
const role = ref(null)      // 'user' | 'admin' | null
const ready = ref(false)

export function useAuthRole() {
  onMounted(() => {
    const stop = onAuthStateChanged(auth, async (u) => {
      user.value = u
      role.value = null
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        role.value = snap.exists() ? (snap.data().role || 'user') : 'user'
      }
      ready.value = true
      stop()
    })
  })
  const isAdmin = () => role.value === 'admin'
  return { user, role, isAdmin, ready }
}