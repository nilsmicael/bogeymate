// pages/summary.js
import { getLeaderboard, getScores } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { roundSummary, handicapRegistration, DEFAULT_PARS, DEFAULT_SI,
         handicapStrokes, playingHandicap, vsParLabel } from '../lib/golf.js'

export async function renderSummary(root) {
  const round = state.currentRound
  if (!round) return navigate('home')

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Hem</button>
        <h1 class="page-title">Rundan klar! 🏌️</h1>
        <div style="width:60px;"></div>
      </div>
      <div id="summary-content"><div class="loading-placeholder" style="padding:32px;text-align:center;">Beräknar resultat…</div></div>
    </div>
  `
  root.querySelector('#back').addEventListener('click', () => navigate('home'))

  try {
    const scores = state._myScores || await getScores(round.id)
    const myScores = scores.filter(s => s.user_id === state.user?.id || !s.user_id)
    const hcp = state.profile?.handicap || 18
    const playHcp = playingHandicap(hcp)
    const holesPlayed = myScores.length
    const grossStbl = myScores.reduce((s, r) => s + (r.stableford_points || 0), 0)
    const stats = roundSummary(myScores, DEFAULT_PARS, DEFAULT_SI)
    const reg = handicapRegistration(grossStbl, holesPlayed || round.holes)

    // Get all players leaderboard
    const allScores = await getLeaderboard(round.id)
    const byPlayer = {}
    for (const s of allScores) {
      if (!byPlayer[s.user_id]) byPlayer[s.user_id] = { name: s.profiles?.full_name || '?', stbl: 0 }
      byPlayer[s.user_id].stbl += s.stableford_points || 0
    }
    const finalBoard = Object.values(byPlayer).sort((a, b) => b.stbl - a.stbl)

    const isBestThisYear = stats.totalStableford > 30 // demo logic

    root.querySelector('#summary-content').innerHTML = `
      <!-- Hero score -->
      <div class="summary-hero">
        <div class="summary-course">${round.course_name} · ${round.holes} hål</div>
        <div class="summary-score">${stats.totalStableford}p</div>
        <div class="summary-vs">Stableford</div>
        <div class="summary-pills">
          <span class="pill pill-gray">+${stats.totalVsPar > 0 ? '+' : ''}${stats.totalVsPar} mot par (brutto)</span>
          ${isBestThisYear ? `<span class="pill pill-green">Bästa runda i år 🎉</span>` : ''}
        </div>
      </div>

      <!-- Stats grid -->
      <div class="summary-grid">
        <div class="sg-card"><div class="sgc-val blue">${stats.eagles}</div><div class="sgc-label">Eagles</div></div>
        <div class="sg-card"><div class="sgc-val blue">${stats.birdies}</div><div class="sgc-label">Birdies</div></div>
        <div class="sg-card"><div class="sgc-val">${stats.pars}</div><div class="sgc-label">Pars</div></div>
        <div class="sg-card"><div class="sgc-val">${stats.totalStrokes}</div><div class="sgc-label">Slag brutto</div></div>
        <div class="sg-card"><div class="sgc-val">${stats.totalNetto}</div><div class="sgc-label">Slag netto</div></div>
        <div class="sg-card"><div class="sgc-val ${stats.bogeys > 8 ? 'red' : ''}">${stats.bogeys + stats.doubles}</div><div class="sgc-label">Bogeyn+</div></div>
      </div>

      <!-- Best holes -->
      ${stats.bestHoles.length ? `
        <div class="section-header">Hålen som räddade dagen</div>
        <div class="hole-podium">
          ${stats.bestHoles.map(s => `
            <div class="podium-card">
              <div class="pc-hole">Hål ${s.hole_number}</div>
              <div class="pc-score">
                <span class="score-box ${scoreClass(s.vs_par_brutto)}">${s.strokes}</span>
              </div>
              <div class="pc-label">${vsParLabel(s.vs_par_brutto)} · ${s.stableford_points}p</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Final leaderboard -->
      <div class="section-header">Slutresultat</div>
      <div class="card card-list" style="margin-bottom:10px;">
        ${finalBoard.map((p, i) => `
          <div class="lb-row">
            <div class="lb-rank">${i + 1}</div>
            <div class="avatar av-${['green','blue','amber','pink'][i % 4]}">${p.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
            <div style="flex:1;font-size:15px;color:var(--color-text);">${p.name}</div>
            <div class="lb-score ${i === 0 ? 'score-good' : ''}">${p.stbl}p</div>
          </div>
        `).join('')}
      </div>

      <!-- Handicap registration -->
      <div class="card info-box-green" style="margin-bottom:10px;">
        <div style="font-weight:500;margin-bottom:6px;">Handicap att registrera på MinGolf</div>
        <div style="font-size:14px;">
          ${reg.registerable
            ? `Registrera <strong>${reg.registrationPoints} poäng</strong> på <strong>mingolf.golf.se</strong><br><small style="opacity:.8;">${reg.note}</small>`
            : `<span style="color:#A32D2D;">${reg.note}</span>`
          }
        </div>
      </div>

      <!-- Share button -->
      <button class="btn-primary" id="share-btn">📤 Dela sammanfattning</button>
      <button class="btn-secondary" id="home-btn">Tillbaka till hem</button>
    `

    root.querySelector('#share-btn').addEventListener('click', () => shareResult(round, stats))
    root.querySelector('#home-btn').addEventListener('click', () => navigate('home'))

  } catch (e) {
    root.querySelector('#summary-content').innerHTML = `
      <div class="empty-state">Kunde inte ladda sammanfattning.<br>${e.message}</div>
      <button class="btn-secondary" onclick="">Tillbaka till hem</button>
    `
    root.querySelector('.btn-secondary').addEventListener('click', () => navigate('home'))
  }
}

async function shareResult(round, stats) {
  const text = `⛳ BogeyMate – ${round.course_name}\n` +
    `${stats.totalStableford}p Stableford · ${stats.birdies} birdies · ${stats.eagles} eagles\n` +
    `Slag brutto: ${stats.totalStrokes} · netto: ${stats.totalNetto}\n` +
    `#BogeyMate #Golf`

  if (navigator.share) {
    try {
      await navigator.share({ title: 'BogeyMate', text })
    } catch {}
  } else {
    await navigator.clipboard.writeText(text)
    showToast('Kopierat till urklipp!', 'success')
  }
}

function scoreClass(diff) {
  if (diff <= -2) return 'score-eagle'
  if (diff === -1) return 'score-birdie'
  if (diff === 1)  return 'score-bogey'
  if (diff >= 2)   return 'score-double'
  return ''
}
