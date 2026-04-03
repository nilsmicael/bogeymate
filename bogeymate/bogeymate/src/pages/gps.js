// ─────────────────────────────────────────────
//  pages/gps.js
//  Live GPS distance screen shown during a round.
//  Shows distance to green center, front and back.
//  Also handles course setup / hole marking mode.
// ─────────────────────────────────────────────

import { navigate, state, showToast } from '../main.js'
import {
  watchPosition, stopWatching,
  distanceMeters, formatDistance, detectCurrentHole
} from '../lib/gps.js'
import { getCourseHoles, upsertHolePoint } from '../lib/courses.js'

let watchId   = null
let playerPos = null   // { lat, lon, accuracy }
let holeData  = []     // array of course_holes rows
let markMode  = false  // true = user is marking GPS points

export async function renderGps(root) {
  const round = state.currentRound
  if (!round) return navigate('home')

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">GPS-avstånd</h1>
        <button class="link-btn" id="mark-toggle">Markera</button>
      </div>

      <!-- GPS status bar -->
      <div id="gps-status" class="gps-status-bar gps-searching">
        📡 Söker GPS-signal…
      </div>

      <!-- Current hole selector -->
      <div class="hole-nav" style="padding: 0 16px; margin-bottom: 8px;">
        <button class="hole-nav-btn" id="hole-prev">‹</button>
        <div class="hole-info" id="hole-info">
          <div class="hole-num" id="gps-hole-display">Hål ${state.currentHole || 1}</div>
          <div class="hole-par-info" id="gps-par-display">Par ${getPar(state.currentHole || 1)}</div>
        </div>
        <button class="hole-nav-btn" id="hole-next">›</button>
      </div>

      <!-- Distance cards -->
      <div id="distance-area">
        <div class="dist-card-grid">
          <div class="dist-card dist-front">
            <div class="dist-card-label">Front</div>
            <div class="dist-val" id="dist-front">–</div>
            <div class="dist-unit" id="dist-front-yd">–</div>
          </div>
          <div class="dist-card dist-center dist-card-main">
            <div class="dist-card-label">Mitten</div>
            <div class="dist-val dist-val-lg" id="dist-center">–</div>
            <div class="dist-unit" id="dist-center-yd">–</div>
          </div>
          <div class="dist-card dist-back">
            <div class="dist-card-label">Bak</div>
            <div class="dist-val" id="dist-back">–</div>
            <div class="dist-unit" id="dist-back-yd">–</div>
          </div>
        </div>
      </div>

      <!-- No data notice / OSM fetch -->
      <div id="no-data-area" style="display:none;">
        <div class="card" style="text-align:center; margin-top: 8px;">
          <div style="font-size:32px; margin-bottom:8px;">📍</div>
          <div style="font-size:15px; font-weight:500; margin-bottom:6px;">Inga GPS-punkter för detta hål</div>
          <div style="font-size:13px; color:var(--color-muted); margin-bottom:16px; line-height:1.5;">
            Gå till greenen och tryck på knappen nedan för att markera positionen.
            Görs bara en gång — alla i appen drar nytta av det.
          </div>
          <button class="btn-primary" style="margin:0;" id="start-mark-btn">Gå till greenen och markera</button>
        </div>
      </div>

      <!-- Marking mode panel -->
      <div id="mark-panel" style="display:none;">
        <div class="section-header">Markera GPS-punkter — hål <span id="mark-hole-num">${state.currentHole || 1}</span></div>
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="mark-row" id="mark-green-center">
            <div class="mark-icon">🏴</div>
            <div class="mark-info">
              <div class="mark-title">Mitten av green</div>
              <div class="mark-sub" id="sub-center">Ej markerat</div>
            </div>
            <button class="mark-btn" data-type="green_center">Markera</button>
          </div>
          <div class="mark-row" id="mark-green-front">
            <div class="mark-icon">⬆️</div>
            <div class="mark-info">
              <div class="mark-title">Framkant green</div>
              <div class="mark-sub" id="sub-front">Ej markerat</div>
            </div>
            <button class="mark-btn" data-type="green_front">Markera</button>
          </div>
          <div class="mark-row" id="mark-green-back">
            <div class="mark-icon">⬇️</div>
            <div class="mark-info">
              <div class="mark-title">Bakkant green</div>
              <div class="mark-sub" id="sub-back">Ej markerat</div>
            </div>
            <button class="mark-btn" data-type="green_back">Markera</button>
          </div>
          <div class="mark-row" style="border-bottom:none;" id="mark-tee">
            <div class="mark-icon">🔵</div>
            <div class="mark-info">
              <div class="mark-title">Tee (valfritt)</div>
              <div class="mark-sub" id="sub-tee">Ej markerat</div>
            </div>
            <button class="mark-btn" data-type="tee">Markera</button>
          </div>
        </div>
        <div style="padding: 0 16px; font-size:12px; color:var(--color-muted); margin-top:6px; line-height:1.5;">
          Stå vid punkten du vill markera och tryck på knappen. GPS-precisionen visas i statusraden ovan.
        </div>
      </div>

      <!-- Accuracy & compass info -->
      <div style="padding: 12px 16px 0; display:flex; gap:8px; flex-wrap:wrap;" id="info-pills">
        <span class="pill pill-gray" id="accuracy-pill">Noggrannhet: –</span>
        <span class="pill pill-gray" id="source-pill">Källa: –</span>
      </div>

      <!-- Go to score -->
      <div style="padding: 16px 16px 0;">
        <button class="btn-secondary" onclick="" id="to-score-btn">✏️ Mata in slag för hål <span id="score-hole-link">${state.currentHole || 1}</span></button>
      </div>
    </div>
  `

  let currentHole = state.currentHole || 1

  // ─── Load hole data ────────────────────────
  if (state.currentRound?.course_id) {
    try {
      holeData = await getCourseHoles(state.currentRound.course_id)
    } catch { holeData = [] }
  }

  // ─── Start GPS ─────────────────────────────
  watchId = watchPosition(
    pos => {
      playerPos = pos
      updateStatus(pos.accuracy)
      updateDistances(currentHole)
    },
    err => {
      root.querySelector('#gps-status').textContent = '⚠️ ' + err
      root.querySelector('#gps-status').className = 'gps-status-bar gps-error'
    }
  )

  // ─── Hole navigation ───────────────────────
  function setHole(h) {
    currentHole = h
    state.currentHole = h
    root.querySelector('#gps-hole-display').textContent = `Hål ${h}`
    root.querySelector('#gps-par-display').textContent  = `Par ${getPar(h)}`
    root.querySelector('#mark-hole-num').textContent    = h
    root.querySelector('#score-hole-link').textContent  = h
    updateDistances(h)
    updateMarkSubtitles(h)
  }

  root.querySelector('#hole-prev').addEventListener('click', () => {
    if (currentHole > 1) setHole(currentHole - 1)
  })
  root.querySelector('#hole-next').addEventListener('click', () => {
    const max = state.currentRound?.holes || 18
    if (currentHole < max) setHole(currentHole + 1)
  })

  // ─── Mark mode toggle ──────────────────────
  root.querySelector('#mark-toggle').addEventListener('click', () => {
    markMode = !markMode
    root.querySelector('#mark-panel').style.display    = markMode ? 'block' : 'none'
    root.querySelector('#mark-toggle').textContent     = markMode ? 'Klar' : 'Markera'
    root.querySelector('#mark-toggle').style.color     = markMode ? '#1D9E75' : ''
    if (markMode) updateMarkSubtitles(currentHole)
  })

  root.querySelector('#start-mark-btn')?.addEventListener('click', () => {
    markMode = true
    root.querySelector('#mark-panel').style.display = 'block'
    root.querySelector('#mark-toggle').textContent  = 'Klar'
    root.querySelector('#no-data-area').style.display = 'none'
    updateMarkSubtitles(currentHole)
  })

  // ─── Mark buttons ──────────────────────────
  root.querySelectorAll('.mark-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!playerPos) return showToast('Väntar på GPS-signal…', 'info')
      if (playerPos.accuracy > 20) return showToast(`GPS-precision ${playerPos.accuracy}m — vänta på bättre signal`, 'offline')

      const pointType = btn.dataset.type
      const courseId  = state.currentRound?.course_id
      if (!courseId) return showToast('Inget bana-ID konfigurerat', 'error')

      btn.textContent = '⏳'
      btn.disabled = true
      try {
        await upsertHolePoint(courseId, currentHole, pointType, playerPos.lat, playerPos.lon, 'manual')
        // Update local cache
        let hole = holeData.find(h => h.hole_number === currentHole)
        if (!hole) { hole = { hole_number: currentHole }; holeData.push(hole) }
        if (pointType === 'green_center') { hole.green_lat = playerPos.lat; hole.green_lon = playerPos.lon }
        if (pointType === 'green_front')  { hole.front_lat = playerPos.lat; hole.front_lon = playerPos.lon }
        if (pointType === 'green_back')   { hole.back_lat  = playerPos.lat; hole.back_lon  = playerPos.lon }
        if (pointType === 'tee')          { hole.tee_lat   = playerPos.lat; hole.tee_lon   = playerPos.lon }
        updateMarkSubtitles(currentHole)
        updateDistances(currentHole)
        showToast('Punkt sparad ✓', 'success')
      } catch (e) {
        showToast('Kunde inte spara: ' + e.message, 'error')
      }
      btn.textContent = 'Markera'
      btn.disabled = false
    })
  })

  // ─── Score button ──────────────────────────
  root.querySelector('#to-score-btn').addEventListener('click', () => {
    stopWatching(watchId)
    navigate('score')
  })

  root.querySelector('#back').addEventListener('click', () => {
    stopWatching(watchId)
    navigate('round')
  })

  // ─── Initial render ────────────────────────
  updateDistances(currentHole)
  updateMarkSubtitles(currentHole)

  // ─── Helpers ──────────────────────────────

  function updateStatus(accuracy) {
    const bar  = root.querySelector('#gps-status')
    const pill = root.querySelector('#accuracy-pill')
    if (!bar) return
    if (accuracy <= 5) {
      bar.textContent = '✓ GPS klar — hög precision'
      bar.className   = 'gps-status-bar gps-good'
    } else if (accuracy <= 15) {
      bar.textContent = `✓ GPS klar — ${accuracy}m noggrannhet`
      bar.className   = 'gps-status-bar gps-ok'
    } else {
      bar.textContent = `⚠️ Låg GPS-precision — ${accuracy}m`
      bar.className   = 'gps-status-bar gps-weak'
    }
    pill.textContent = `Noggrannhet: ±${accuracy}m`
  }

  function updateDistances(holeNum) {
    const hole = holeData.find(h => h.hole_number === holeNum)
    const noData = root.querySelector('#no-data-area')
    const distArea = root.querySelector('#distance-area')

    const hasCenter = hole?.green_lat && hole?.green_lon

    if (!hasCenter) {
      noData.style.display    = 'block'
      distArea.style.display  = 'none'
      return
    }
    noData.style.display   = 'none'
    distArea.style.display = 'block'

    if (!playerPos) {
      setDistDisplay('center', null)
      setDistDisplay('front',  null)
      setDistDisplay('back',   null)
      root.querySelector('#source-pill').textContent = 'Källa: ' + (hole.source === 'osm' ? 'OpenStreetMap' : 'Manuell')
      return
    }

    // Center
    const dCenter = distanceMeters(playerPos.lat, playerPos.lon, hole.green_lat, hole.green_lon)
    setDistDisplay('center', dCenter)

    // Front
    if (hole.front_lat) {
      setDistDisplay('front', distanceMeters(playerPos.lat, playerPos.lon, hole.front_lat, hole.front_lon))
    } else {
      setDistDisplay('front', null, '–')
    }

    // Back
    if (hole.back_lat) {
      setDistDisplay('back', distanceMeters(playerPos.lat, playerPos.lon, hole.back_lat, hole.back_lon))
    } else {
      setDistDisplay('back', null, '–')
    }

    root.querySelector('#source-pill').textContent = 'Källa: ' + (hole.source === 'osm' ? 'OpenStreetMap' : 'Manuell')
  }

  function setDistDisplay(pos, meters, fallback = '–') {
    const mEl  = root.querySelector(`#dist-${pos}`)
    const ydEl = root.querySelector(`#dist-${pos}-yd`)
    if (!mEl) return
    if (meters === null) {
      mEl.textContent  = fallback
      if (ydEl) ydEl.textContent = ''
      return
    }
    const d = formatDistance(meters)
    mEl.textContent  = d.meters
    if (ydEl) ydEl.textContent = `${d.yards} yd`

    // Color coding: green < 100m, amber 100–180m, red > 180m
    mEl.style.color = meters < 100 ? '#1D9E75' : meters < 180 ? '#854F0B' : '#A32D2D'
  }

  function updateMarkSubtitles(holeNum) {
    const hole = holeData.find(h => h.hole_number === holeNum)
    const fmt  = (lat, lon) => lat ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Ej markerat'
    const s = (id, text) => { const el = root.querySelector(id); if (el) el.textContent = text }
    s('#sub-center', fmt(hole?.green_lat, hole?.green_lon))
    s('#sub-front',  fmt(hole?.front_lat, hole?.front_lon))
    s('#sub-back',   fmt(hole?.back_lat,  hole?.back_lon))
    s('#sub-tee',    fmt(hole?.tee_lat,   hole?.tee_lon))
  }
}

// Par lookup (same as score.js — could be from course data)
const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,3,5,4,4,5,3,4,4]
function getPar(hole) { return DEFAULT_PARS[hole - 1] || 4 }
