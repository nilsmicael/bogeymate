// main.js — App entry point, router, history stack
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
import { renderStats }       from './pages/stats.js'
import { renderFollowBall }  from './pages/follow-ball.js'
import { renderHelp }        from './pages/help.js'
import { checkFirstRun }     from './pages/help.js'

export const state = {
  user: null,
  profile: null,
  currentRound: null,
  currentHole: 1,
  isGuest: false
}

const routes = {
  login:       renderLogin,
  home:        renderHome,
  newround:    renderNewRound,
  round:       renderRound,
  score:       renderScore,
  summary:     renderSummary,
  settings:    renderSettings,
  gps:         renderGps,
  coursesetup: renderCourseSetup,
  stats:       renderStats,
  followball:  renderFollowBall,
  help:        renderHelp
}

// ─── History stack for back navigation ───────
const _history = []

export function navigate(page, params = {}, addToHistory = true) {
  Object.assign(state, params)
  const root = document.getElementById('root')
  root.innerHTML = ''
  const renderer = routes[page]
  if (!renderer) return
  if (addToHistory && window._currentPage && window._currentPage !== page) {
    _history.push(window._currentPage)
  }
  window._currentPage = page
  // Push browser history entry so back button works
  window.history.pushState({ page }, '', '/' + (page === 'home' ? '' : page))
  renderer(root)
}

export function navigateBack() {
  const prev = _history.pop()
  if (prev) navigate(prev, {}, false)
  else navigate('home', {}, false)
}

// ─── Browser back button (mobile + desktop) ──
window.addEventListener('popstate', (e) => {
  e.preventDefault()
  const prev = _history.pop()
  if (prev) {
    window._currentPage = prev
    const root = document.getElementById('root')
    root.innerHTML = ''
    const renderer = routes[prev]
    if (renderer) renderer(root)
  } else {
    // At root — push a new state so next back press is catchable
    window.history.pushState({ page: 'home' }, '', '/')
    navigate('home', {}, false)
  }
})

// ─── Toast ────────────────────────────────────
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bm-toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = 'bm-toast'
  const colors = {
    success: { bg: '#E1F5EE', border: '#5DCAA5', color: '#0F6E56' },
    error:   { bg: '#FCEBEB', border: '#F09595', color: '#A32D2D' },
    info:    { bg: '#E6F1FB', border: '#85B7EB', color: '#185FA5' },
    offline: { bg: '#FAEEDA', border: '#FAC775', color: '#854F0B' },
    funny:   { bg: '#FAEEDA', border: '#FAC775', color: '#854F0B' }
  }
  const c = colors[type] || colors.info
  toast.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:${c.bg};border:0.5px solid ${c.border};color:${c.color};
    padding:10px 18px;border-radius:999px;font-size:13px;font-weight:500;
    z-index:9999;white-space:nowrap;max-width:90vw;text-align:center;
    box-shadow:0 2px 8px rgba(0,0,0,.1);
  `
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast?.remove(), 4000)
}

// ─── Humor messages ───────────────────────────
export const HUMOR = {
  tripleOrWorse: [
    "🤦 Trippelbogey! Det finns andra sätt att spendera sin tid…",
    "😬 Vad hände där? Bollen hittade varje bunker på hålet.",
    "🌳 Skogen kallar — och den svarade uppenbarligen.",
    "⛳ Statistiken tackar dig varmt för bidraget.",
    "🙈 Vi säger inget. Vi tänker det bara.",
    "💀 Hålet vann. Klart och tydligt.",
    "🎻 Någon spelar fiol i bakgrunden…"
  ],
  bogey: [
    "😤 Bogey. Kunde ha gått värre. (Men ändå.)",
    "🙄 En bogey till i samlingen.",
  ],
  par: [
    "👏 Par! Inte glamoröst, men hederligt.",
    "✅ Par. Exakt vad banan förväntade sig.",
  ],
  birdie: [
    "🐦 BIRDIE! Någon vet faktiskt vad de håller på med!",
    "🔥 Birdie! Resten av sällskapet noterar med avundsjuka.",
    "⭐ Birdie! Spara skärmdumpen — det händer inte varje dag.",
  ],
  eagle: [
    "🦅 EAGLE!!! Är du säker på att du räknade rätt?",
    "🎉 EAGLE! Hela banan hörde jublet (eller borde ha gjort det).",
    "🏆 Eagle! Direkt in i legendernas hall.",
  ],
  holeInOne: [
    "🚨🚨🚨 HOLE IN ONE!!! RING ALLA DU KÄNNER. NU. GENAST.",
    "😱 HÅL I ETT! Statistiskt sett borde detta inte ha hänt.",
    "🍾 HOLE IN ONE! Traditionsenligt bjuder du på en runda i baren.",
  ]
}

export function humorMessage(vsParBrutto) {
  const msgs = vsParBrutto >= 3 ? HUMOR.tripleOrWorse
    : vsParBrutto === 2 ? HUMOR.bogey
    : vsParBrutto === 1 ? HUMOR.bogey
    : vsParBrutto === 0 ? HUMOR.par
    : vsParBrutto === -1 ? HUMOR.birdie
    : vsParBrutto === -2 ? HUMOR.eagle
    : HUMOR.holeInOne
  return msgs[Math.floor(Math.random() * msgs.length)]
}

// ─── Offline indicator ────────────────────────
function updateOfflineBar() {
  const queued = getQueueLength()
  let bar = document.getElementById('offline-status-bar')
  if (!navigator.onLine) {
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'offline-status-bar'
      bar.style.cssText = 'position:fixed;bottom:60px;left:0;right:0;background:#FCEBEB;border-top:0.5px solid #F09595;color:#A32D2D;font-size:12px;padding:8px 16px;text-align:center;z-index:999;'
      document.body.appendChild(bar)
    }
    bar.textContent = queued > 0 ? `Offline – ${queued} slag väntar på uppladdning` : 'Offline – slag sparas lokalt'
  } else if (bar) { bar.remove() }
}
setInterval(updateOfflineBar, 5000)
window.addEventListener('online',  updateOfflineBar)
window.addEventListener('offline', updateOfflineBar)
window.addEventListener('online', async () => {
  const flushed = await flushQueue()
  if (flushed > 0) showToast(`✓ ${flushed} slag synkroniserade`, 'success')
})

// ─── Boot ─────────────────────────────────────
async function boot() {
  // Handle Supabase auth redirect (email confirm, password reset)
  const hash = window.location.hash
  if (hash.includes('error=access_denied')) {
    navigate('login')
    showToast('Bekräftelselänken har gått ut — begär en ny', 'error')
    return
  }
  const session = await getSession()
  if (session) { state.user = session.user; navigate('home'); setTimeout(() => checkFirstRun(document.getElementById('root')), 800) }
  else navigate('login')
}
boot()

// ─── First login tip dialog ───────────────────
export function showFirstLoginTip() {
  const key = 'bm_tip_shown'
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')

  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:var(--color-bg,#fff);border-radius:16px 16px 0 0;padding:24px 20px 32px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;">
      <div style="font-size:28px;text-align:center;margin-bottom:12px;">💡</div>
      <div style="font-size:18px;font-weight:500;text-align:center;margin-bottom:16px;">Tips för bästa upplevelse</div>

      <div style="font-size:14px;line-height:1.7;color:#444;">
        <p style="margin-bottom:12px;"><strong>📱 Håll appen aktiv i bakgrunden</strong><br>
        Annars kan appen pausa och du missar live-uppdateringar.</p>

        <p style="font-weight:500;margin-bottom:4px;">iPhone:</p>
        <p style="margin-bottom:12px;">Gå till <em>Inställningar → Skärmtid → Alltid tillåtet</em> och lägg till Safari. Alternativt: håll skärmen aktiv under rundan.</p>

        <p style="font-weight:500;margin-bottom:4px;">Android:</p>
        <p style="margin-bottom:12px;">Gå till <em>Inställningar → Appar → Chrome → Batteri</em> och välj <em>"Ingen begränsning"</em>. Aktivera även <em>"Håll skärmen aktiv"</em> i BogeyMate under Inställningar.</p>

        <p style="margin-bottom:12px;"><strong>🏠 Lägg till på hemskärmen</strong><br>
        Öppna BogeyMate i Safari (iPhone) eller Chrome (Android), tryck dela-knappen och välj "Lägg till på hemskärmen".</p>

        <p><strong>📡 Offline-läge</strong><br>
        Inga problem om du tappar signal — slag sparas lokalt och laddas upp automatiskt.</p>
      </div>

      <button id="tip-close" style="width:100%;padding:13px;margin-top:20px;border:none;border-radius:12px;background:#1D9E75;color:#fff;font-size:15px;font-weight:500;cursor:pointer;">
        Förstått — dags att spela! ⛳
      </button>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.querySelector('#tip-close').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove() })
}
