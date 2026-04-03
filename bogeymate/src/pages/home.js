// pages/home.js
import { getActiveRounds, getFinishedRounds, getProfile } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { activityStatus } from '../lib/golf.js'
import { renderBottomNav, wireBottomNav } from '../components/bottom-nav.js'

export async function renderHome(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <span class="app-name-sm">⛳ BogeyMate</span>
        <button class="link-btn" id="settings-btn">⚙ Inställningar</button>
      </div>
      <div id="notif-area"></div>
      <div class="section-header">Aktiva rundor</div>
      <div id="active-rounds"><div class="loading-placeholder">Laddar rundor…</div></div>
      <button class="btn-primary" id="new-round-btn">+ Starta ny runda</button>
      <div class="section-header">Tidigare rundor</div>
      <div id="finished-rounds"><div class="loading-placeholder">Laddar historik…</div></div>
    </div>
    ${renderBottomNav('home')}
  `

  wireBottomNav(); root.querySelector('#settings-btn').addEventListener('click', () => navigate('settings'))
  root.querySelector('#new-round-btn').addEventListener('click', () => {
    if (state.isGuest) return showToast('Logga in för att starta en runda', 'info')
    navigate('newround')
  })

  // Load profile
  if (state.user && !state.profile) {
    try {
      state.profile = await getProfile(state.user.id)
    } catch {}
  }

  // Show notification banner if profile wants it
  if (state.profile?.notify_new_round) {
    root.querySelector('#notif-area').innerHTML = `
      <div class="notif-banner">
        🔔 <span><strong>Erik Lindgren</strong> startade en runda på Delsjö GK ·
        <span class="link-inline" id="follow-notif">Följ →</span></span>
        <button class="notif-close" id="close-notif">✕</button>
      </div>
    `
    root.querySelector('#close-notif')?.addEventListener('click', e => {
      e.target.closest('.notif-banner').remove()
    })
  }

  // Active rounds
  try {
    const rounds = await getActiveRounds()
    const el = root.querySelector('#active-rounds')
    if (!rounds.length) {
      el.innerHTML = `<div class="empty-state">Inga aktiva rundor just nu.<br>Starta en eller vänta på att en vän startar!</div>`
    } else {
      el.innerHTML = rounds.map(r => renderRoundCard(r)).join('')
      rounds.forEach(r => {
        root.querySelector(`#rc-${r.id}`)?.addEventListener('click', () => {
          navigate('round', { currentRound: r })
        })
      })
    }
  } catch {
    root.querySelector('#active-rounds').innerHTML = `<div class="empty-state">Kunde inte ladda rundor.</div>`
  }

  // Finished rounds
  if (!state.isGuest && state.user) {
    try {
      const finished = await getFinishedRounds(state.user.id)
      const el = root.querySelector('#finished-rounds')
      if (!finished.length) {
        el.innerHTML = `<div class="empty-state">Inga tidigare rundor.</div>`
      } else {
        el.innerHTML = `<div class="card card-list">${finished.slice(0,5).map(renderHistoryRow).join('')}</div>`
        finished.slice(0,5).forEach(r => {
          root.querySelector(`#hr-${r.id}`)?.addEventListener('click', () => {
            navigate('summary', { currentRound: r })
          })
        })
      }
    } catch {}
  } else {
    root.querySelector('#finished-rounds').innerHTML = `<div class="empty-state">Logga in för att se din historik.</div>`
  }
}

function renderRoundCard(round) {
  const players = round.round_players || []
  const initials = players.map(p => {
    const n = p.profiles?.full_name || '?'
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
  }).join(' · ')

  return `
    <div class="round-card" id="rc-${round.id}">
      <div class="round-card-header">
        <div class="rc-top">
          <div>
            <div class="rc-course">${round.course_name}</div>
            <div class="rc-meta">${round.holes} hål · ${formatLabel(round.format)}${round.is_shotgun ? ' · Shotgun hål ' + round.start_hole : ''}</div>
          </div>
          <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
        </div>
        <div class="rc-pills">
          <span class="pill pill-teal">Du spelar</span>
          <span class="pill pill-gray">${players.length} spelare</span>
        </div>
      </div>
      <div class="round-card-body">
        <div class="rc-stat"><div class="rc-stat-label">Spelare</div><div class="rc-stat-val">${initials || '–'}</div></div>
        <div class="rc-stat"><div class="rc-stat-label">Format</div><div class="rc-stat-val">${formatLabel(round.format)}</div></div>
      </div>
    </div>
  `
}

function renderHistoryRow(round) {
  const myScores = round.scores || []
  const total = myScores.reduce((s, r) => s + (r.stableford_points || 0), 0)
  return `
    <div class="list-row" id="hr-${round.id}">
      <div style="flex:1;">
        <div class="row-title">${round.course_name} · ${round.holes} hål</div>
        <div class="row-sub">${formatDate(round.finished_at)} · ${formatLabel(round.format)}</div>
      </div>
      <div style="text-align:right;">
        <div class="row-score">${total} stbl</div>
      </div>
    </div>
  `
}

function formatLabel(fmt) {
  const map = { slagspel:'Slagspel', stableford:'Stableford', matchspel:'Matchspel',
    fourball:'Four-ball', foursome:'Foursome', scramble:'Scramble', bestball:'Best ball' }
  return map[fmt] || fmt
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day:'numeric', month:'short' })
}
