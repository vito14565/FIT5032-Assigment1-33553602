// src/main.js
import { createApp, nextTick } from 'vue'
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

// Your custom styles (contains .sr-only, focus styles, etc.)
import './style.css'

// ---------------- A11y: route announcer (screen-reader live region) ----------------
function ensureAnnouncer() {
  let el = document.getElementById('route-announcer')
  if (!el) {
    el = document.createElement('div')
    el.id = 'route-announcer'
    el.setAttribute('aria-live', 'polite')
    el.className = 'sr-only'
    document.body.appendChild(el)
  }
  return el
}
const announcer = ensureAnnouncer()

function announce(text) {
  // retrigger SR by clearing then setting text
  announcer.textContent = ''
  Promise.resolve().then(() => { announcer.textContent = text })
}

function focusMain() {
  const main = document.getElementById('main')
  if (!main) return
  // Quiet the outline for programmatic focus (keyboard focus still visible)
  main.setAttribute('tabindex', '-1')
  main.focus({ preventScroll: false })
  main.addEventListener('blur', () => {
    main.removeAttribute('tabindex')
    main.classList.remove('focus-quiet')
  }, { once: true })
}

// ---------------- Mount app after auth state is known (avoid flicker) ----------------
let app
onAuthStateChanged(auth, () => {
  if (app) return

  app = createApp(App)

  // Router hooks for title + a11y
  router.afterEach(async (to) => {
    const base = 'Health Hub'
    const page =
      (to.meta && (to.meta.title || to.meta.pageTitle)) ||
      (typeof to.name === 'string' ? to.name : '') ||
      'Page'
    document.title = page ? `${base} — ${page}` : base

    await nextTick()
    focusMain()
    announce(`${page} loaded`)
    window.scrollTo({ top: 0, left: 0 })
  })

  app.use(router)

  app.use(PrimeVue, {
    ripple: true,
    inputStyle: 'outlined',
  })

  app.mount('#app')
})

// ---------------- Optional: initial title if SSR/static load ----------------
if (!document.title) {
  document.title = 'Health Hub'
}