// pages/round.js
import { getLeaderboard, getScores, getReactions, addReaction,
         subscribeToRound, unsubscribe, finishRound } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { buildLeaderboard, activityStatus, handicapRegistration,
         DEFAULT_PARS, DEFAULT_SI, playingHandicap } from '../lib/golf.js'
import { renderBottomNav } from '../components/bottom-nav.js'

let realtimeChannel = null

export async function renderRound(root) {
  const round = state.currentRound
  if (!round) return navigate('home')

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Hem</button>
        <h1 class="page-title">${round.course_name}</h1>
        ${!state.isGuest ? `<button class="link-btn" id="go-score">Slag →</button>` : `<div style="width:60px;"></div>`}
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="board">Leaderboard</button>
        <button class="tab-btn" data-tab="card">Scorekort</button>
        <button class="tab-btn" data-tab="hcp">Handicap</button>
      </div>

      <div id="tab-board">
        <div style="padding:0 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
          <span class="pill pill-gray">${round.holes} hål</span>
          <span class="pill pill-amber">${formatLabel(round.format)}</span>
          ${round.is_shotgun ? `<span class="pill pill-blue">Shotgun hål ${round.start_hole}</span>` : ''}
        </div>
        <div class="card card-list" id="leaderboard-list"><div class="loading-placeholder">Laddar leaderboard…</div></div>
        <div class="section-header">Reaktioner</div>
        <div class="reactions-row" id="reactions-row">
          <button class="react-btn" data-emoji="👏">👏<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="🔥">🔥<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="😬">😬<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="🎉">🎉<span class="react-count">0</span></button>
        </div>
        ${!state.isGuest ? `<button class="btn-primary" id="finish-btn" style="margin-top:16px;">Avsluta rundan</button>` : ''}
      </div>

      <div id="tab-card" style="display:none;">
        <div id="scorecard-content"><div class="loading-placeholder" style="padding:16px;">Laddar scorekort…</div></div>
      </div>

      <div id="tab-hcp" style="display:none;">
        <div id="hcp-content"></div>
      </div>
    </div>
    ${renderBottomNav('round')}
  `

  // Navigation
  root.querySelector('#back').addEventListener('click', () => {
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('home')
  })
  root.querySelector('#go-score')?.addEventListener('click', () => navigate('score'))

  // Tabs
  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      root.querySelectorAll('[id^=tab-]').forEach(t => t.style.display = 'none')
      const tab = root.querySelector(`#tab-${btn.dataset.tab}`)
      tab.style.display = 'block'
      if (btn.dataset.tab === 'hcp') renderHcpTab()
    })
  })

  // Finish round
  root.querySelector('#finish-btn')?.addEventListener('click', async () => {
    if (!confirm('Är du säker på att du vill avsluta rundan?')) return
    await finishRound(round.id)
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('summary')
  })

  // Reactions
  root.querySelectorAll('.react-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji
      try {
        await addReaction(round.id, state.currentHole || 1, state.user?.id, emoji)
        const count = btn.querySelector('.react-count')
        count.textContent = parseInt(count.textContent) + 1
        btn.style.background = 'var(--color-bg-secondary)'
        setTimeout(() => btn.style.background = 'transparent', 400)
      } catch {}
    })
  })

  // Load data
  await loadLeaderboard(root, round)
  await loadReactions(root, round)

  // Realtime subscription
  realtimeChannel = subscribeToRound(
    round.id,
    () => loadLeaderboard(root, round),
    () => loadReactions(root, round)
  )

  function renderHcpTab() {
    const myScores = state._myScores || []
    const holesPlayed = myScores.filter(s => !s.picked_up).length
    const grossStbl = myScores.reduce((s, r) => s + (r.stableford_points || 0), 0)
    const reg = handicapRegistration(grossStbl, holesPlayed || round.holes)
    root.querySelector('#hcp-content').innerHTML = `
      <div class="section-header" style="margin-top:0;">Handicap-underlag</div>
      <div class="hcp-summary card">
        <div class="hcp-row"><span class="hcp-label">Spelade hål</span><span class="hcp-val">${holesPlayed}</span></div>
        <div class="hcp-row"><span class="hcp-label">Stableford (brutto)</span><span class="hcp-val">${grossStbl}p</span></div>
        <div class="hcp-row"><span class="hcp-label">Systemtillägg</span><span class="hcp-val">+${reg.addition}p</span></div>
        <div class="hcp-row"><span class="hcp-label">Registrera på MinGolf</span><span class="hcp-val green">${reg.registrationPoints ?? '–'}p</span></div>
      </div>
      <div class="card info-box-green">
        ${reg.registerable
          ? `Gå till <strong>mingolf.golf.se</strong> och registrera <strong>${reg.registrationPoints} poäng</strong>.<br><small>${reg.note}</small>`
          : `<span style="color:#A32D2D;">${reg.note}</span>`
        }
      </div>
    `
  }
}

async function loadLeaderboard(root, round) {
  try {
    const [scores, players] = await Promise.all([
      getLeaderboard(round.id),
      Promise.resolve(round.round_players || [])
    ])
    state._myScores = scores.filter(s => s.user_id === state.user?.id)
    const board = buildLeaderboard(scores, players)
    const el = root.querySelector('#leaderboard-list')
    if (!el) return
    if (!board.length) { el.innerHTML = `<div class="empty-state">Inga slag registrerade ännu.</div>`; return }
    el.innerHTML = board.map((p, i) => {
      const act = activityStatus(p.lastUpdated)
      return `
        <div class="lb-row">
          <div class="lb-rank">${i + 1}</div>
          <div class="avatar av-${avatarColor(i)}">${initials(p.name)}</div>
          <div class="lb-info">
            <div class="lb-name">${p.name}</div>
            <div class="lb-activity"><span class="activity-dot ${act.cls}"></span>${p.holesPlayed > 0 ? `Hål ${p.lastHole} · ` : ''}${act.label}</div>
          </div>
          <div class="lb-score ${p.totalStableford > 0 ? 'score-good' : ''}">${p.totalStableford}p</div>
        </div>
      `
    }).join('')

    // Scorecard tab
    renderScorecard(root, scores, players, round)
  } catch (e) {
    root.querySelector('#leaderboard-list').innerHTML = `<div class="empty-state">Kunde inte ladda leaderboard.</div>`
  }
}

function renderScorecard(root, scores, players, round) {
  const el = root.querySelector('#scorecard-content')
  if (!el) return
  const holeCount = round.holes
  const holes = Array.from({ length: holeCount }, (_, i) => i + 1)
  const scoreMap = {}
  for (const s of scores) {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id] = {}
    scoreMap[s.user_id][s.hole_number] = s
  }

  el.innerHTML = `<div style="overflow-x:auto;padding:0 16px;">
    <table class="scorecard-table">
      <thead>
        <tr><th class="sc-label">Hål</th>${holes.map(h => `<th>${h}</th>`).join('')}</tr>
        <tr><th class="sc-label sc-muted">Par</th>${holes.map(h => `<td class="sc-par">${DEFAULT_PARS[h-1]}</td>`).join('')}</tr>
      </thead>
      <tbody>
        ${players.map((p, pi) => `
          <tr>
            <td class="sc-label" style="color:${playerColor(pi)};">${initials(p.profiles?.full_name)}</td>
            ${holes.map(h => {
              const s = scoreMap[p.user_id]?.[h]
              if (!s) return `<td><span class="score-box sc-empty">–</span></td>`
              if (s.picked_up) return `<td><span class="score-box sc-pickup">P</span></td>`
              const cls = scoreClass(s.vs_par_brutto)
              return `<td><span class="score-box ${cls}">${s.strokes}</span></td>`
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="sc-legend">
      <span><span class="score-box score-birdie" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">B</span> Birdie</span>
      <span><span class="score-box score-bogey" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">B</span> Bogey</span>
      <span><span class="score-box score-double" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">D</span> Dubbel+</span>
      <span><span class="score-box sc-pickup" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">P</span> Plockat</span>
    </div>
  </div>`
}

async function loadReactions(root, round) {
  try {
    const reactions = await getReactions(round.id)
    const counts = { '👏':0, '🔥':0, '😬':0, '🎉':0 }
    for (const r of reactions) if (counts[r.emoji] !== undefined) counts[r.emoji]++
    root.querySelectorAll('.react-btn').forEach(btn => {
      btn.querySelector('.react-count').textContent = counts[btn.dataset.emoji] || 0
    })
  } catch {}
}

// Helpers
function scoreClass(vsParBrutto) {
  if (vsParBrutto <= -2) return 'score-eagle'
  if (vsParBrutto === -1) return 'score-birdie'
  if (vsParBrutto === 0) return ''
  if (vsParBrutto === 1) return 'score-bogey'
  return 'score-double'
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
const COLORS = ['av-green','av-blue','av-amber','av-pink','av-purple','av-teal']
function avatarColor(i) { return COLORS[i % COLORS.length].replace('av-','') }
function playerColor(i) {
  const c = ['#0F6E56','#185FA5','#854F0B','#993556','#534AB7','#0F6E56']
  return c[i % c.length]
}
function formatLabel(fmt) {
  const map = { slagspel:'Slagspel', stableford:'Stableford', matchspel:'Matchspel',
    fourball:'Four-ball', foursome:'Foursome', scramble:'Scramble', bestball:'Best ball' }
  return map[fmt] || fmt
}
