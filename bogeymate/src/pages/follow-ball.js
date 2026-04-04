// pages/follow-ball.js
// Follow another group's round live while playing yourself
import { navigate, state, showToast } from '../main.js'
import { getActiveRounds, getLeaderboard } from '../lib/supabase.js'
import { subscribeToRound, unsubscribe } from '../lib/supabase.js'
import { buildLeaderboard, activityStatus } from '../lib/golf.js'

let realtimeChannel = null

export async function renderFollowBall(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Följ en boll</h1>
        <div style="width:60px;"></div>
      </div>

      <div style="padding:0 16px;margin-bottom:10px;font-size:14px;color:var(--color-muted);line-height:1.5;">
        Välj en aktiv runda att följa. Du ser deras leaderboard live medan du själv spelar.
      </div>

      <div class="section-header" style="margin-top:0;">Aktiva rundor just nu</div>
      <div id="round-list"><div class="loading-placeholder">Laddar rundor…</div></div>

      <div id="live-view" style="display:none;">
        <div class="top-bar" style="margin-top:16px;">
          <div style="font-size:15px;font-weight:500;" id="live-course">–</div>
          <button class="link-btn" id="stop-follow">Sluta följa</button>
        </div>
        <div style="padding:0 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
          <span class="pill pill-blue">Du tittar</span>
          <span class="pill pill-gray" id="live-format">–</span>
        </div>
        <div class="card card-list" id="live-leaderboard">
          <div class="loading-placeholder">Laddar leaderboard…</div>
        </div>
        <div style="padding:0 16px;font-size:12px;color:var(--color-muted);margin-top:6px;line-height:1.5;">
          Leaderboarden uppdateras automatiskt när de registrerar slag.
        </div>
      </div>
    </div>
  `

  root.querySelector('#back').addEventListener('click', () => {
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('round')
  })

  root.querySelector('#stop-follow').addEventListener('click', () => {
    if (realtimeChannel) { unsubscribe(realtimeChannel); realtimeChannel = null }
    root.querySelector('#live-view').style.display = 'none'
    root.querySelector('#round-list').style.display = 'block'
    loadRounds()
  })

  async function loadRounds() {
    try {
      const rounds = await getActiveRounds()
      const myRoundId = state.currentRound?.id
      // Exclude own round
      const others = rounds.filter(r => r.id !== myRoundId)
      const el = root.querySelector('#round-list')
      if (!el) return
      if (!others.length) {
        el.innerHTML = `<div class="empty-state">Inga andra aktiva rundor just nu.<br>Vänta på att en vän startar!</div>`
        return
      }
      el.innerHTML = others.map(r => {
        const players = (r.round_players || []).map(p => p.profiles?.full_name?.split(' ')[0] || '?').join(', ')
        return `
          <div class="round-card" data-rid="${r.id}" data-course="${r.course_name}" data-format="${r.format}" style="cursor:pointer;">
            <div class="round-card-header">
              <div class="rc-top">
                <div>
                  <div class="rc-course">${r.course_name}</div>
                  <div class="rc-meta">${r.holes} hål · ${formatLabel(r.format)}</div>
                </div>
                <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
              </div>
              <div style="margin-top:6px;font-size:13px;color:var(--color-muted);">👥 ${players}</div>
            </div>
          </div>
        `
      }).join('')

      el.querySelectorAll('.round-card').forEach(card => {
        card.addEventListener('click', () => followRound(card.dataset.rid, card.dataset.course, card.dataset.format, rounds.find(r=>r.id===card.dataset.rid)))
      })
    } catch(e) {
      const el = root.querySelector('#round-list')
      if (el) el.innerHTML = `<div class="empty-state">Kunde inte ladda rundor.</div>`
    }
  }

  async function followRound(roundId, courseName, format, round) {
    root.querySelector('#round-list').style.display = 'none'
    root.querySelector('#live-view').style.display  = 'block'
    root.querySelector('#live-course').textContent  = courseName
    root.querySelector('#live-format').textContent  = formatLabel(format)

    if (realtimeChannel) unsubscribe(realtimeChannel)

    await loadLiveLeaderboard(roundId, round)

    realtimeChannel = subscribeToRound(roundId,
      () => loadLiveLeaderboard(roundId, round),
      () => {}
    )
  }

  async function loadLiveLeaderboard(roundId, round) {
    try {
      const scores  = await getLeaderboard(roundId)
      const players = round?.round_players || []
      const board   = buildLeaderboard(scores, players)
      const el      = root.querySelector('#live-leaderboard')
      if (!el) return
      if (!board.length) { el.innerHTML = `<div class="empty-state">Inga slag registrerade ännu.</div>`; return }
      el.innerHTML = board.map((p, i) => {
        const act = activityStatus(p.lastUpdated)
        const avatarColors = ['av-green','av-blue','av-amber','av-pink']
        const initials = p.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
        return `
          <div class="lb-row">
            <div class="lb-rank">${i+1}</div>
            <div class="avatar ${avatarColors[i%4]}">${initials}</div>
            <div class="lb-info">
              <div class="lb-name">${p.name}</div>
              <div class="lb-activity"><span class="activity-dot ${act.cls}"></span>${p.holesPlayed>0?'Hål '+p.lastHole+' · ':''}${act.label}</div>
            </div>
            <div class="lb-score ${p.totalStableford>0?'score-good':''}">${p.totalStableford}p</div>
          </div>
        `
      }).join('')
    } catch {}
  }

  loadRounds()
}

function formatLabel(fmt) {
  const map = { slagspel:'Slagspel', stableford:'Stableford', matchspel:'Matchspel',
    fourball:'Four-ball', foursome:'Foursome', scramble:'Scramble', bestball:'Best ball',
    lagmatchspel:'Lagmatchspel' }
  return map[fmt] || fmt
}
