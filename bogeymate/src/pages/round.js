// pages/round.js — Live round with leaderboard, scorecard tabs, follow other groups
import { getLeaderboard, getScores, getReactions, addReaction,
         subscribeToRound, unsubscribe, finishRound, getActiveRounds } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { buildLeaderboard, activityStatus, handicapRegistration,
         DEFAULT_PARS, DEFAULT_SI, playingHandicap } from '../lib/golf.js'
import { renderBottomNav, wireBottomNav } from '../components/bottom-nav.js'

let realtimeChannel = null

export async function renderRound(root) {
  const round = state.currentRound
  if (!round) return navigate('home')

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Hem</button>
        <h1 class="page-title" style="font-size:15px;">${round.course_name}</h1>
        ${!state.isGuest ? `<button class="link-btn" id="go-score">Slag →</button>` : `<div style="width:60px;"></div>`}
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="board">Leaderboard</button>
        <button class="tab-btn" data-tab="card-stbl">Poängbogey</button>
        <button class="tab-btn" data-tab="card-slag">Slag</button>
        <button class="tab-btn" data-tab="follow">Följ</button>
        <button class="tab-btn" data-tab="hcp">HCP</button>
      </div>

      <div id="tab-board">
        <div style="padding:0 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
          <span class="pill pill-gray">${round.holes} hål</span>
          <span class="pill pill-amber">${formatLabel(round.format)}</span>
          ${round.is_shotgun?`<span class="pill pill-blue">Shotgun hål ${round.start_hole}</span>`:''}
        </div>
        <div class="card card-list" id="leaderboard-list"><div class="loading-placeholder">Laddar…</div></div>
        <div class="section-header">Reaktioner</div>
        <div class="reactions-row" id="reactions-row">
          <button class="react-btn" data-emoji="👏">👏<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="🔥">🔥<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="😬">😬<span class="react-count">0</span></button>
          <button class="react-btn" data-emoji="🎉">🎉<span class="react-count">0</span></button>
        </div>
        <div class="comment-area" id="comment-area">
          <div id="comment-list" style="padding:0 16px;margin-bottom:6px;"></div>
          <div style="display:flex;gap:8px;padding:0 16px;">
            <input type="text" id="comment-input" placeholder="Skriv en kommentar…" style="flex:1;font-size:14px;" maxlength="120" />
            <button class="btn-small-green" id="comment-send">Skicka</button>
          </div>
        </div>
        ${!state.isGuest?`<button class="btn-primary" id="finish-btn" style="margin-top:16px;">Avsluta rundan</button>`:''}
      </div>

      <!-- Poängbogey scorecard -->
      <div id="tab-card-stbl" style="display:none;">
        <div id="scorecard-stbl"><div class="loading-placeholder" style="padding:16px;">Laddar…</div></div>
      </div>

      <!-- Slag scorecard -->
      <div id="tab-card-slag" style="display:none;">
        <div id="scorecard-slag"><div class="loading-placeholder" style="padding:16px;">Laddar…</div></div>
      </div>

      <!-- Follow other groups -->
      <div id="tab-follow" style="display:none;">
        <div class="section-header" style="margin-top:0;">Andra aktiva rundor</div>
        <div id="other-rounds"><div class="loading-placeholder">Laddar…</div></div>
        <div id="follow-detail" style="display:none;">
          <div class="top-bar" style="padding:8px 16px;margin-bottom:8px;">
            <button class="back-btn" id="follow-back">← Alla rundor</button>
            <h1 class="page-title" id="follow-title" style="font-size:14px;"></h1>
            <div style="width:60px;"></div>
          </div>
          <div class="card card-list" id="follow-leaderboard"></div>
        </div>
      </div>

      <!-- HCP tab -->
      <div id="tab-hcp" style="display:none;">
        <div id="hcp-content"></div>
      </div>
    </div>
    ${renderBottomNav('round')}
  `

  root.querySelector('#back').addEventListener('click', () => {
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('home')
  })
  root.querySelector('#go-score')?.addEventListener('click', () => navigate('score'))
  wireBottomNav()

  // Tabs
  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      root.querySelectorAll('[id^=tab-]').forEach(t => t.style.display='none')
      root.querySelector(`#tab-${btn.dataset.tab}`).style.display='block'
      if (btn.dataset.tab==='hcp') renderHcpTab()
      if (btn.dataset.tab==='follow') loadOtherRounds()
    })
  })

  // Finish
  root.querySelector('#follow-ball-btn')?.addEventListener('click', () => {
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('followball')
  })

  root.querySelector('#finish-btn')?.addEventListener('click', async () => {
    if (!confirm('Är du säker på att du vill avsluta rundan?')) return
    await finishRound(round.id)
    if (realtimeChannel) unsubscribe(realtimeChannel)
    navigate('summary')
  })

  // Reactions
  root.querySelectorAll('.react-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await addReaction(round.id, state.currentHole||1, state.user?.id, btn.dataset.emoji)
        const c = btn.querySelector('.react-count')
        c.textContent = parseInt(c.textContent)+1
        btn.style.background='var(--color-bg-secondary)'
        setTimeout(()=>btn.style.background='transparent',400)
      } catch {}
    })
  })

  // Comments
  const commentsKey = 'bm_comments_'+round.id
  function loadComments() {
    const list=root.querySelector('#comment-list'); if(!list) return
    const saved=JSON.parse(localStorage.getItem(commentsKey)||'[]')
    list.innerHTML=saved.slice(-5).map(c=>`<div class="comment-bubble"><strong>${c.name}</strong> ${c.text}</div>`).join('')
  }
  root.querySelector('#comment-send')?.addEventListener('click', () => {
    const inp=root.querySelector('#comment-input'); const text=inp?.value?.trim(); if(!text) return
    const saved=JSON.parse(localStorage.getItem(commentsKey)||'[]')
    saved.push({name:state.profile?.full_name||'Gäst',text,time:Date.now()})
    localStorage.setItem(commentsKey,JSON.stringify(saved))
    inp.value=''; loadComments()
  })
  root.querySelector('#comment-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')root.querySelector('#comment-send')?.click()})
  loadComments()

  // Follow other round back button
  root.querySelector('#follow-back')?.addEventListener('click', () => {
    root.querySelector('#follow-detail').style.display='none'
    root.querySelector('#other-rounds').style.display='block'
  })

  // Load data
  await loadLeaderboard(root, round)
  await loadReactions(root, round)

  realtimeChannel = subscribeToRound(
    round.id,
    () => loadLeaderboard(root, round),
    () => loadReactions(root, round)
  )

  // ─── Follow other rounds ─────────────────
  async function loadOtherRounds() {
    const el = root.querySelector('#other-rounds')
    root.querySelector('#follow-detail').style.display='none'
    el.style.display='block'
    el.innerHTML='<div class="loading-placeholder">Laddar aktiva rundor…</div>'
    try {
      const rounds = await getActiveRounds()
      const others = rounds.filter(r => r.id !== round.id)
      if (!others.length) {
        el.innerHTML='<div class="empty-state">Inga andra aktiva rundor just nu.</div>'
        return
      }
      el.innerHTML = others.map(r => {
        const players = (r.round_players||[]).map(p=>p.profiles?.full_name||'?').join(', ')
        return `<div class="round-card" data-rid="${r.id}" style="margin-bottom:8px;cursor:pointer;">
          <div class="round-card-header">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-size:15px;font-weight:500;">${r.course_name}</div>
                <div style="font-size:12px;color:var(--color-muted);margin-top:2px;">${r.holes} hål · ${formatLabel(r.format)}</div>
              </div>
              <span class="pill pill-green"><span class="status-dot dot-live"></span>Live</span>
            </div>
          </div>
          <div class="round-card-body">
            <div class="rc-stat"><div class="rc-stat-label">Spelare</div><div class="rc-stat-val" style="font-size:13px;">${players}</div></div>
          </div>
        </div>`
      }).join('')
      el.querySelectorAll('.round-card').forEach(card => {
        card.addEventListener('click', async () => {
          const rid = card.dataset.rid
          const r2  = others.find(r=>r.id===rid)
          if (!r2) return
          root.querySelector('#follow-title').textContent = r2.course_name
          root.querySelector('#other-rounds').style.display='none'
          root.querySelector('#follow-detail').style.display='block'
          const lbEl = root.querySelector('#follow-leaderboard')
          lbEl.innerHTML='<div class="loading-placeholder">Laddar leaderboard…</div>'
          try {
            const scores = await getLeaderboard(rid)
            const board  = buildLeaderboard(scores, r2.round_players||[])
            lbEl.innerHTML = board.map((p,i) => {
              const act = activityStatus(p.lastUpdated)
              return `<div class="lb-row">
                <div class="lb-rank">${i+1}</div>
                <div class="avatar av-${['green','blue','amber','pink'][i%4]}">${initials(p.name)}</div>
                <div class="lb-info">
                  <div class="lb-name">${p.name}</div>
                  <div class="lb-activity"><span class="activity-dot ${act.cls}"></span>${p.holesPlayed>0?`Hål ${p.lastHole} · `:''}${act.label}</div>
                </div>
                <div class="lb-score ${p.totalStableford>0?'score-good':''}">${p.totalStableford}p</div>
              </div>`
            }).join('') || '<div class="empty-state">Inga slag registrerade än.</div>'
          } catch { lbEl.innerHTML='<div class="empty-state">Kunde inte ladda.</div>' }
        })
      })
    } catch { el.innerHTML='<div class="empty-state">Kunde inte ladda rundor.</div>' }
  }

  // ─── HCP tab ──────────────────────────────
  function renderHcpTab() {
    const myScores = state._myScores||[]
    const holesPlayed = myScores.filter(s=>!s.picked_up).length
    const grossStbl   = myScores.reduce((s,r)=>s+(r.stableford_points||0),0)
    const reg = handicapRegistration(grossStbl, holesPlayed||round.holes)
    root.querySelector('#hcp-content').innerHTML=`
      <div class="section-header" style="margin-top:0;">Handicap-underlag</div>
      <div class="hcp-summary card">
        <div class="hcp-row"><span class="hcp-label">Spelade hål</span><span class="hcp-val">${holesPlayed}</span></div>
        <div class="hcp-row"><span class="hcp-label">Stableford (brutto)</span><span class="hcp-val">${grossStbl}p</span></div>
        <div class="hcp-row"><span class="hcp-label">Systemtillägg</span><span class="hcp-val">+${reg.addition}p</span></div>
        <div class="hcp-row"><span class="hcp-label">Registrera på MinGolf</span><span class="hcp-val green">${reg.registrationPoints??'–'}p</span></div>
      </div>
      <div class="card info-box-green">
        ${reg.registerable
          ?`Gå till <strong>mingolf.golf.se</strong> och registrera <strong>${reg.registrationPoints} poäng</strong>.<br><small>${reg.note}</small>`
          :`<span style="color:#A32D2D;">${reg.note}</span>`}
      </div>`
  }
}

async function loadLeaderboard(root, round) {
  try {
    const [scores] = await Promise.all([getLeaderboard(round.id)])
    state._myScores = scores.filter(s=>s.user_id===state.user?.id)
    const board = buildLeaderboard(scores, round.round_players||[])
    const el = root.querySelector('#leaderboard-list')
    if (!el) return
    if (!board.length) { el.innerHTML=`<div class="empty-state">Inga slag registrerade ännu.</div>`; return }
    el.innerHTML = board.map((p,i) => {
      const act=activityStatus(p.lastUpdated)
      return `<div class="lb-row">
        <div class="lb-rank">${i+1}</div>
        <div class="avatar av-${avatarCol(i)}">${initials(p.name)}</div>
        <div class="lb-info">
          <div class="lb-name">${p.name}</div>
          <div class="lb-activity"><span class="activity-dot ${act.cls}"></span>${p.holesPlayed>0?`Hål ${p.lastHole} · `:''}${act.label}</div>
        </div>
        <div class="lb-score ${p.totalStableford>0?'score-good':''}">${p.totalStableford}p</div>
      </div>`
    }).join('')
    renderScorecards(root, scores, round.round_players||[], round)
  } catch { root.querySelector('#leaderboard-list').innerHTML=`<div class="empty-state">Kunde inte ladda.</div>` }
}

function renderScorecards(root, scores, players, round) {
  const holeCount = round.holes
  const holes = Array.from({length:holeCount},(_,i)=>i+1)
  const scoreMap={}
  for (const s of scores) {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id]={}
    scoreMap[s.user_id][s.hole_number]=s
  }

  // Poängbogey scorecard
  const stblEl = root.querySelector('#scorecard-stbl')
  if (stblEl) stblEl.innerHTML = buildScorecard(players, holes, scoreMap, 'stbl')

  // Slag scorecard
  const slagEl = root.querySelector('#scorecard-slag')
  if (slagEl) slagEl.innerHTML = buildScorecard(players, holes, scoreMap, 'slag')
}

function buildScorecard(players, holes, scoreMap, mode) {
  return `<div style="overflow-x:auto;padding:0 16px;">
    <table class="scorecard-table">
      <thead>
        <tr><th class="sc-label">Hål</th>${holes.map(h=>`<th>${h}</th>`).join('')}<th>Tot</th></tr>
        <tr><th class="sc-label sc-muted">Par</th>${holes.map(h=>`<td class="sc-par">${DEFAULT_PARS[h-1]}</td>`).join('')}<td class="sc-par">${holes.reduce((s,h)=>s+DEFAULT_PARS[h-1],0)}</td></tr>
      </thead>
      <tbody>
        ${players.map((p,pi) => {
          let total = 0
          const cells = holes.map(h => {
            const s=scoreMap[p.user_id]?.[h]
            if (!s) return `<td><span class="score-box sc-empty">–</span></td>`
            if (s.picked_up) return `<td><span class="score-box sc-pickup">P</span></td>`
            if (mode==='stbl') {
              total += s.stableford_points||0
              const pts=s.stableford_points||0
              const cls=pts>=3?'score-eagle':pts>=2?'score-birdie':pts===1?'':pts===0?'score-bogey':''
              return `<td><span class="score-box ${cls}">${pts}</span></td>`
            } else {
              total += s.strokes||0
              return `<td><span class="score-box ${scoreClass(s.vs_par_brutto)}">${s.strokes}</span></td>`
            }
          }).join('')
          return `<tr>
            <td class="sc-label" style="color:${playerColor(pi)};">${initials(p.profiles?.full_name)}</td>
            ${cells}
            <td style="font-weight:500;font-size:12px;color:${playerColor(pi)};">${total}${mode==='stbl'?'p':''}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    <div class="sc-legend">
      ${mode==='stbl'
        ?`<span><span class="score-box score-eagle" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">3</span> 3p+</span>
          <span><span class="score-box score-birdie" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">2</span> 2p</span>
          <span><span class="score-box score-bogey" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">0</span> 0p</span>`
        :`<span><span class="score-box score-birdie" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">B</span> Birdie</span>
          <span><span class="score-box score-bogey" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">B</span> Bogey</span>
          <span><span class="score-box score-double" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">D</span> Dubbel+</span>`}
      <span><span class="score-box sc-pickup" style="width:16px;height:16px;line-height:16px;font-size:10px;display:inline-block;">P</span> Plockat</span>
    </div>
  </div>`
}

async function loadReactions(root, round) {
  try {
    const reactions = await getReactions(round.id)
    const counts={'👏':0,'🔥':0,'😬':0,'🎉':0}
    for (const r of reactions) if (counts[r.emoji]!==undefined) counts[r.emoji]++
    root.querySelectorAll('.react-btn').forEach(btn=>{
      btn.querySelector('.react-count').textContent=counts[btn.dataset.emoji]||0
    })
  } catch {}
}

function scoreClass(d) {
  if (d<=-2) return 'score-eagle'; if (d===-1) return 'score-birdie'
  if (d===0) return ''; if (d===1) return 'score-bogey'; return 'score-double'
}
function initials(name) { if(!name) return '?'; return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }
const AVCOLS=['green','blue','amber','pink','purple','teal']
function avatarCol(i){return AVCOLS[i%AVCOLS.length]}
function playerColor(i){return ['#0F6E56','#185FA5','#854F0B','#993556','#534AB7','#0F6E56'][i%6]}
function formatLabel(fmt){
  const m={slagspel:'Slagspel',stableford:'Stableford',matchspel:'Matchspel',
    fourball:'Four-ball',foursome:'Foursome',scramble:'Scramble',bestball:'Best ball',lagmatchspel:'Lagmatchspel'}
  return m[fmt]||fmt
}
