// pages/score.js
import { upsertScore, queueScore, getQueueLength } from '../lib/supabase.js'
import { navigate, state, showToast, humorMessage } from '../main.js'
import { DEFAULT_PARS, DEFAULT_SI, handicapStrokes,
         stablefordPoints, maxStrokes, vsParLabel, playingHandicap } from '../lib/golf.js'

export function renderScore(root) {
  const round = state.currentRound
  if (!round) return navigate('home')

  const hcp = state.profile?.handicap || 18
  const playHcp = playingHandicap(hcp)
  let hole = state.currentHole || round.start_hole || 1
  let strokes = DEFAULT_PARS[hole - 1] + 1   // default: bogey
  let pickedUp = false

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Mata in slag</h1>
        <div style="width:60px;"></div>
      </div>

      <div id="offline-bar" style="display:none;" class="offline-bar">
        <span class="status-dot" style="background:#E24B4A;display:inline-block;"></span>
        Offline – slag sparas lokalt
      </div>

      <div style="padding:0 16px;">
        <!-- Hole navigator -->
        <div class="hole-nav">
          <button class="hole-nav-btn" id="prev-hole">‹</button>
          <div class="hole-info">
            <div class="hole-num" id="hole-display">Hål ${hole}</div>
            <div class="hole-par-info" id="par-display"></div>
            <div style="margin-top:4px;" id="hcp-badge"></div>
          </div>
          <button class="hole-nav-btn" id="next-hole">›</button>
        </div>

        <!-- Quick +/- input -->
        <div style="font-size:12px;color:var(--color-muted);text-align:center;margin-bottom:6px;">Antal slag</div>
        <div class="quick-score">
          <button class="qs-btn" id="minus">−</button>
          <div class="qs-num" id="stroke-display">${strokes}</div>
          <button class="qs-btn" id="plus">+</button>
        </div>

        <!-- Result card -->
        <div class="card result-card" id="result-card">
          <div style="display:flex;justify-content:space-around;">
            <div><div class="card-label">Mot par</div><div class="result-val" id="vs-par">–</div></div>
            <div><div class="card-label">Stableford</div><div class="result-val green" id="stbl">–</div></div>
            <div><div class="card-label">Netto</div><div class="result-val" id="netto">–</div></div>
          </div>
        </div>

        <!-- Pick up -->
        <div class="pickup-row">
          <div>
            <div class="pickup-title">Plockat upp</div>
            <div class="pickup-sub" id="max-label"></div>
          </div>
          <button class="pickup-btn" id="pickup-btn">Markera</button>
        </div>

        <button class="btn-primary" id="save-btn">Spara hål ${hole}</button>
        <button class="btn-secondary" id="to-gps-btn">📡 GPS-avstånd till green</button>
        <button class="btn-secondary" id="to-board">Se leaderboard</button>
      </div>
    </div>
  `

  function update() {
    const par = DEFAULT_PARS[hole - 1]
    const si  = DEFAULT_SI[hole - 1]
    const hs  = handicapStrokes(playHcp, si)
    const max = maxStrokes(par, hs)

    root.querySelector('#hole-display').textContent = `Hål ${hole}`
    root.querySelector('#par-display').textContent  = `Par ${par} · SI ${si}`
    root.querySelector('#hcp-badge').innerHTML      = `<span class="pill pill-amber">HCP-slag: ${hs}</span>`
    root.querySelector('#max-label').textContent    = `Max hål: netto dubbel-bogey (${max} slag)`
    root.querySelector('#save-btn').textContent     = `Spara hål ${hole}`

    if (pickedUp) {
      root.querySelector('#stroke-display').textContent = '–'
      root.querySelector('#vs-par').textContent = '–'
      root.querySelector('#vs-par').className   = 'result-val'
      root.querySelector('#stbl').textContent   = '0p'
      root.querySelector('#stbl').className     = 'result-val muted'
      root.querySelector('#netto').textContent  = '–'
      root.querySelector('#pickup-btn').textContent = 'Ångra'
      root.querySelector('#pickup-btn').classList.add('active')
    } else {
      root.querySelector('#stroke-display').textContent = strokes
      const diff = strokes - par
      const vpEl = root.querySelector('#vs-par')
      vpEl.textContent = vsParLabel(diff)
      vpEl.className   = diff < 0 ? 'result-val green' : diff > 0 ? 'result-val red' : 'result-val'
      const pts = stablefordPoints(strokes, par, hs)
      const stblEl = root.querySelector('#stbl')
      stblEl.textContent = `${pts}p`
      stblEl.className   = pts >= 3 ? 'result-val blue' : pts >= 2 ? 'result-val green' : pts === 1 ? 'result-val amber' : 'result-val red'
      root.querySelector('#netto').textContent = strokes - hs
      root.querySelector('#pickup-btn').textContent = 'Markera'
      root.querySelector('#pickup-btn').classList.remove('active')
    }

    // Offline indicator
    root.querySelector('#offline-bar').style.display = navigator.onLine ? 'none' : 'flex'
  }

  update()

  // Hole navigation
  root.querySelector('#prev-hole').addEventListener('click', () => {
    if (hole > 1) { hole--; strokes = DEFAULT_PARS[hole-1] + 1; pickedUp = false; update() }
  })
  root.querySelector('#next-hole').addEventListener('click', () => {
    const maxH = round.holes || 18
    if (hole < maxH) { hole++; strokes = DEFAULT_PARS[hole-1] + 1; pickedUp = false; update() }
  })

  // Stroke adjustment
  root.querySelector('#minus').addEventListener('click', () => {
    if (!pickedUp) { strokes = Math.max(1, strokes - 1); update() }
  })
  root.querySelector('#plus').addEventListener('click', () => {
    if (!pickedUp) { strokes = Math.min(20, strokes + 1); update() }
  })

  // Pick up
  root.querySelector('#pickup-btn').addEventListener('click', () => {
    pickedUp = !pickedUp; update()
  })

  // Save
  root.querySelector('#save-btn').addEventListener('click', async () => {
    const par = DEFAULT_PARS[hole - 1]
    const si  = DEFAULT_SI[hole - 1]
    const hs  = handicapStrokes(playHcp, si)
    const scoreData = {
      roundId: round.id,
      userId:  state.user.id,
      holeNumber: hole,
      strokes: pickedUp ? null : strokes,
      pickedUp,
      par,
      handicapStrokes: hs
    }

    if (!navigator.onLine) {
      queueScore(scoreData)
      showToast(`Hål ${hole} sparat offline`, 'offline')
    } else {
      try {
        await upsertScore(scoreData)
        const diff = pickedUp ? 1 : sel - pars[hole-1];
        if (diff <= -1 || diff >= 3) {
          showToast(humorMessage(diff), diff <= -2 ? 'success' : diff === -1 ? 'success' : 'funny')
        } else {
          showToast(`H00e5l ${hole} sparat 2713`, 'success')
        }
      } catch {
        queueScore(scoreData)
        showToast(`Hål ${hole} sparat offline`, 'offline')
      }
    }

    // Advance to next hole
    state.currentHole = hole
    const maxH = round.holes || 18
    if (hole < maxH) {
      hole++; strokes = DEFAULT_PARS[hole-1] + 1; pickedUp = false; update()
    } else {
      navigate('summary')
    }
  })

  root.querySelector('#back').addEventListener('click',     () => navigate('round'))
  root.querySelector('#to-gps-btn').addEventListener('click', () => navigate('gps'))
  root.querySelector('#to-board').addEventListener('click', () => navigate('round'))
}
