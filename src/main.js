// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

// --- 先載第三方 CSS，再載自訂樣式 ---
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'

// PrimeVue v3：核心與樣式
import PrimeVue from 'primevue/config'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

// 主題 + PrimeVue 基礎樣式（v3 需要這兩條）
import 'primevue/resources/themes/aura-light-blue/theme.css'
import 'primevue/resources/primevue.min.css'

import './style.css'

// --- 延後掛載（等 auth 狀態就緒，避免閃爍） ---
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