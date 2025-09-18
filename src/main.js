// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

// --- Load third-party CSS first, then custom styles ---
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'

// PrimeVue v3: core and styles
import PrimeVue from 'primevue/config'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

// Theme + PrimeVue base styles (both required for v3)
import 'primevue/resources/themes/aura-light-blue/theme.css'
import 'primevue/resources/primevue.min.css'

import './style.css'

// --- Delayed mount (wait for auth state to be ready to avoid flicker) ---
let app
onAuthStateChanged(auth, () => {
  if (!app) {
    app = createApp(App)

    app.use(router)

    app.use(PrimeVue, {
      ripple: true,
      inputStyle: 'outlined',
    })

    app.mount('#app')
  }
})