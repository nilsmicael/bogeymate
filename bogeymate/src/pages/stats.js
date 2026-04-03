// pages/stats.js — Season statistics page
import { navigate, state } from '../main.js'
import { renderBottomNav, wireBottomNav } from '../components/bottom-nav.js'
import { getFinishedRounds, getScores } from '../lib/supabase.js'

export async function renderStats(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Min statistik</h1>
        <div style="width:60px;"></div>
      </div>
      <div id="stats-content">
        <div class="loading-placeholder" style="padding:40px;text-align:center;">Laddar statistik…</div>
      </div>
    </div>
    ${renderBottomNav('stats')}
  `
  root.querySelector('#back').addEventListener('click', () => navigate('home'))
  wireBottomNav()

  if (state.isGuest || !state.user) {
    root.querySelector('#stats-content').innerHTML = `<div class="empty-state">Logga in för att se din statistik.</div>`
    return
  }

  try {
    const rounds = await getFinishedRounds(state.user.id)
    if (!rounds.length) {
      root.querySelector('#stats-content').innerHTML = `
        <div class="empty-state" style="padding:48px 24px;">
          <div style="font-size:40px;margin-bottom:12px;">📊</div>
          Ingen statistik ännu — spela några rundor först!
        </div>`
      return
    }

    // Aggregate stats across all rounds
    let totalRounds = rounds.length
    let totalBirdies = 0, totalEagles = 0, totalPars = 0, totalBogeys = 0, totalDouble = 0, totalTriple = 0
    let totalStrokes = 0, totalStableford = 0, totalHoles = 0
    const stablefordPerRound = []

    for (const r of rounds) {
      const scores = r.scores || []
      let roundStbl = 0
      for (const s of scores) {
        if (s.picked_up) continue
        const diff = s.vs_par_brutto
        if (diff <= -2) totalEagles++
        else if (diff === -1) totalBirdies++
        else if (diff === 0) totalPars++
        else if (diff === 1) totalBogeys++
        else if (diff === 2) totalDouble++
        else if (diff >= 3) totalTriple++
        totalStrokes += s.strokes || 0
        totalStableford += s.stableford_points || 0
        roundStbl += s.stableford_points || 0
        totalHoles++
      }
      stablefordPerRound.push({ date: r.finished_at, course: r.course_name, stbl: roundStbl, holes: r.holes })
    }

    const avgStbl = totalRounds ? Math.round(totalStableford / totalRounds) : 0
    const avgStrokes = totalHoles ? (totalStrokes / totalHoles).toFixed(1) : '–'
    const bestRound = stablefordPerRound.reduce((b, r) => r.stbl > b.stbl ? r : b, stablefordPerRound[0])

    root.querySelector('#stats-content').innerHTML = `
      <div class="section-header" style="margin-top:0;">Säsongsöversikt</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 16px;margin-bottom:10px;">
        ${statCard('Rundor spelade', totalRounds, '')}
        ${statCard('Snitt Stableford', avgStbl, 'p')}
        ${statCard('Birdies totalt', totalBirdies, '', '#185FA5')}
        ${statCard('Eagles totalt', totalEagles, '', '#1D9E75')}
        ${statCard('Snitt slag/hål', avgStrokes, '')}
        ${statCard('Trippelbogey+', totalTriple, '', '#A32D2D')}
      </div>

      <div class="section-header">Håldistribution</div>
      <div class="card" style="padding:14px 16px;margin-bottom:10px;">
        ${distBar('Eagles', totalEagles, totalHoles, '#185FA5')}
        ${distBar('Birdies', totalBirdies, totalHoles, '#1D9E75')}
        ${distBar('Pars', totalPars, totalHoles, '#5F5E5A')}
        ${distBar('Bogeys', totalBogeys, totalHoles, '#854F0B')}
        ${distBar('Dubbel-bogey', totalDouble, totalHoles, '#E24B4A')}
        ${distBar('Trippel+', totalTriple, totalHoles, '#A32D2D')}
      </div>

      <div class="section-header">Bästa runda</div>
      <div class="card" style="margin-bottom:10px;">
        <div style="font-size:22px;font-weight:500;color:#1D9E75;">${bestRound.stbl}p</div>
        <div style="font-size:14px;color:var(--color-muted);margin-top:4px;">${bestRound.course} · ${formatDate(bestRound.date)}</div>
      </div>

      <div class="section-header">Rundhistorik</div>
      <div class="card card-list" style="margin-bottom:10px;">
        ${stablefordPerRound.slice(0,10).map(r => `
          <div class="list-row" style="cursor:default;">
            <div style="flex:1;">
              <div class="row-title">${r.course}</div>
              <div class="row-sub">${formatDate(r.date)} · ${r.holes} hål</div>
            </div>
            <div style="font-size:16px;font-weight:500;color:${r.stbl >= avgStbl ? '#1D9E75' : 'var(--color-text)'};">${r.stbl}p</div>
          </div>
        `).join('')}
      </div>
    `
  } catch(e) {
    root.querySelector('#stats-content').innerHTML = `<div class="empty-state">Kunde inte ladda statistik.</div>`
  }
}

function statCard(label, value, unit, color = 'var(--color-text)') {
  return `<div class="card" style="margin:0;text-align:center;">
    <div style="font-size:11px;color:var(--color-hint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${label}</div>
    <div style="font-size:26px;font-weight:500;color:${color};">${value}${unit}</div>
  </div>`
}

function distBar(label, count, total, color) {
  const pct = total ? Math.round(count / total * 100) : 0
  return `<div style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
      <span style="color:var(--color-text);">${label}</span>
      <span style="color:var(--color-muted);">${count} (${pct}%)</span>
    </div>
    <div style="height:6px;background:var(--color-bg-secondary);border-radius:3px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s;"></div>
    </div>
  </div>`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric' })
}
