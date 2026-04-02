// ─────────────────────────────────────────────
//  main.js  — App entry point & simple router
// ─────────────────────────────────────────────

import { getSession, flushQueue, getQueueLength } from './lib/supabase.js'
import { renderLogin }       from './pages/login.js'
import { renderHome }        from './pages/home.js'
import { renderNewRound }    from './pages/new-round.js'
import { renderRound }       from './pages/round.js'
import { renderScore }       from './pages/score.js'
import { renderSummary }     from './pages/summary.js'
import { renderSettings }    from './pages/settings.js'
import { renderGps }         from './pages/gps.js'
import { renderCourseSetup } from './pages/course-setup.js'

// ─── Global app state ────────────────────────
export const state = {
  user: null,
  profile: null,
  currentRound: null,
  currentHole: 1,
  isGuest: false
}

// ─── Router ──────────────────────────────────
const routes = {
  login:       renderLogin,
  home:        renderHome,
  newround:    renderNewRound,
  round:       renderRound,
  score:       renderScore,
  summary:     renderSummary,
  settings:    renderSettings,
  gps:         renderGps,
  coursesetup: renderCourseSetup
}

export function navigate(page, params = {}) {
  Object.assign(state, params)
  const root = document.getElementById('root')
  root.innerHTML = ''
  const renderer = routes[page]
  if (renderer) renderer(root)
  // Save current page for back-navigation
  window._currentPage = page
}

// ─── Offline sync ────────────────────────────
window.addEventListener('online', async () => {
  const flushed = await flushQueue()
  if (flushed > 0) {
    showToast(`✓ ${flushed} slag synkroniserade`, 'success')
  }
})

// ─── Toast notifications ─────────────────────
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bm-toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = 'bm-toast'
  const colors = {
    success: { bg: '#E1F5EE', border: '#5DCAA5', color: '#0F6E56' },
    error:   { bg: '#FCEBEB', border: '#F09595', color: '#A32D2D' },
    info:    { bg: '#E6F1FB', border: '#85B7EB', color: '#185FA5' },
    offline: { bg: '#FAEEDA', border: '#FAC775', color: '#854F0B' }
  }
  const c = colors[type] || colors.info
  toast.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    background: ${c.bg}; border: 0.5px solid ${c.border}; color: ${c.color};
    padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 500;
    z-index: 9999; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,.08);
  `
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

// ─── Offline indicator ───────────────────────
function updateOfflineBar() {
  const queued = getQueueLength()
  let bar = document.getElementById('offline-status-bar')
  if (!navigator.onLine) {
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'offline-status-bar'
      bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#FCEBEB;border-top:0.5px solid #F09595;color:#A32D2D;font-size:12px;padding:8px 16px;text-align:center;z-index:999;'
      document.body.appendChild(bar)
    }
    bar.textContent = queued > 0
      ? `Offline – ${queued} slag väntar på uppladdning`
      : 'Offline – slag sparas lokalt'
  } else if (bar) {
    bar.remove()
  }
}
setInterval(updateOfflineBar, 5000)
window.addEventListener('online',  updateOfflineBar)
window.addEventListener('offline', updateOfflineBar)

// ─── Boot ─────────────────────────────────────
async function boot() {
  const session = await getSession()
  if (session) {
    state.user = session.user
    navigate('home')
  } else {
    navigate('login')
  }
}

boot()
