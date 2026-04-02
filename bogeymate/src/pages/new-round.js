// pages/new-round.js
import { createRound, addPlayerToRound, createInvite, getProfile } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { FORMAT_DESCRIPTIONS } from '../lib/golf.js'

export function renderNewRound(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Ny runda</h1>
        <div style="width:60px;"></div>
      </div>

      <div class="form-section">
        <div class="input-row"><label>Golfklubb / bana</label><input type="text" id="course" placeholder="T.ex. Vallda Sandsjö GK" /></div>
        <div class="input-row">
          <label>Antal hål</label>
          <select id="holes">
            <option value="18">18 hål</option>
            <option value="9">9 hål</option>
            <option value="12">12 hål</option>
          </select>
        </div>
        <div id="holes-info" class="info-box" style="display:none;"></div>
      </div>

      <div class="section-header">Spelform</div>
      <div class="format-grid" id="format-grid">
        ${Object.entries(FORMAT_DESCRIPTIONS).map(([key, f]) => `
          <div class="fmt-opt ${key === 'stableford' ? 'selected' : ''}" data-fmt="${key}">
            <div class="fo-name">${f.label}</div>
            <div class="fo-desc">${f.desc}</div>
          </div>
        `).join('')}
      </div>

      <div class="section-header">Starthål</div>
      <div class="start-grid">
        <div class="start-opt selected" id="so-1" data-hole="1">
          <div class="so-num">Hål 1</div><div class="so-label">Vanlig start</div>
        </div>
        <div class="start-opt" id="so-10" data-hole="10">
          <div class="so-num">Hål 10</div><div class="so-label">Bakre nio</div>
        </div>
      </div>
      <div class="form-section">
        <button class="btn-outline" id="shotgun-toggle">🎯 Shotgun-start — välj valfritt starthål</button>
      </div>
      <div id="shotgun-panel" style="display:none;margin-bottom:4px;">
        <div style="padding:0 16px;font-size:12px;color:var(--color-muted);margin-bottom:8px;">Välj vilket hål du börjar på:</div>
        <div class="shotgun-grid" id="sg-grid"></div>
      </div>

      <div class="section-header">Bjud in spelare</div>
      <div class="invite-tabs" id="invite-tabs">
        <button class="invite-tab active" data-tab="sms">SMS</button>
        <button class="invite-tab" data-tab="email">E-post</button>
        <button class="invite-tab" data-tab="app">App-användare</button>
      </div>
      <div id="invite-sms" class="invite-panel">
        <div class="form-section">
          <div class="input-row">
            <label>Mobilnummer</label>
            <div style="display:flex;gap:8px;">
              <input type="tel" id="sms-number" placeholder="+46 70 123 45 67" style="flex:1;" />
              <button class="btn-small-green" id="sms-send">Skicka</button>
            </div>
          </div>
          <div id="sms-preview" style="display:none;" class="preview-box"></div>
        </div>
      </div>
      <div id="invite-email" class="invite-panel" style="display:none;">
        <div class="form-section">
          <div class="input-row">
            <label>E-postadress</label>
            <div style="display:flex;gap:8px;">
              <input type="email" id="email-addr" placeholder="vän@epost.se" style="flex:1;" />
              <button class="btn-small-green" id="email-send">Skicka</button>
            </div>
          </div>
        </div>
      </div>
      <div id="invite-app" class="invite-panel" style="display:none;">
        <div class="card card-list">
          <div class="list-row">
            <div class="avatar av-blue">EL</div>
            <div style="flex:1;"><div class="row-title">Erik Lindgren</div><div class="row-sub">HCP 12.1</div></div>
            <button class="invite-add-btn" data-uid="mock-1">+ Lägg till</button>
          </div>
          <div class="list-row">
            <div class="avatar av-amber">AJ</div>
            <div style="flex:1;"><div class="row-title">Anna Johansson</div><div class="row-sub">HCP 24.8 · Vanligt sällskap</div></div>
            <button class="invite-add-btn added" data-uid="mock-2">Tillagd</button>
          </div>
        </div>
      </div>

      <div class="section-header">Spelare i rundan</div>
      <div class="card card-list" id="player-list">
        <div class="list-row">
          <div class="avatar av-green">MC</div>
          <div style="flex:1;"><div class="row-title">${state.profile?.full_name || 'Du'} (värd)</div><div class="row-sub">HCP ${state.profile?.handicap || '–'}</div></div>
          <span class="pill pill-teal">Värd</span>
        </div>
      </div>

      <button class="btn-primary" id="start-btn">Starta runda</button>
    </div>
  `

  let selectedFormat  = 'stableford'
  let selectedStart   = 1
  let selectedShotgun = 0

  // Back
  root.querySelector('#back').addEventListener('click', () => navigate('home'))

  // Holes info
  root.querySelector('#holes').addEventListener('change', function() {
    const info = root.querySelector('#holes-info')
    const msgs = {
      '9':  '9 hål registreras som separat 9-hålsrond på MinGolf.',
      '12': '12 hål: systemet adderar 11 poäng (6 hål × 2p − 1) vid registrering på MinGolf.',
      '18': ''
    }
    const msg = msgs[this.value]
    if (msg) { info.textContent = msg; info.style.display = 'block' }
    else info.style.display = 'none'
  })

  // Format selection
  root.querySelectorAll('.fmt-opt').forEach(el => {
    el.addEventListener('click', () => {
      root.querySelectorAll('.fmt-opt').forEach(e => e.classList.remove('selected'))
      el.classList.add('selected')
      selectedFormat = el.dataset.fmt
    })
  })

  // Start hole
  root.querySelectorAll('.start-opt').forEach(el => {
    el.addEventListener('click', () => {
      root.querySelectorAll('.start-opt').forEach(e => e.classList.remove('selected'))
      el.classList.add('selected')
      selectedStart = parseInt(el.dataset.hole)
      selectedShotgun = 0
      root.querySelector('#shotgun-panel').style.display = 'none'
    })
  })

  // Shotgun
  root.querySelector('#shotgun-toggle').addEventListener('click', () => {
    const panel = root.querySelector('#shotgun-panel')
    const open = panel.style.display === 'block'
    panel.style.display = open ? 'none' : 'block'
    if (!open) {
      root.querySelectorAll('.start-opt').forEach(e => e.classList.remove('selected'))
      const grid = root.querySelector('#sg-grid')
      grid.innerHTML = ''
      for (let i = 1; i <= 18; i++) {
        const b = document.createElement('button')
        b.className = 'sg-btn'
        b.textContent = i
        b.addEventListener('click', () => {
          root.querySelectorAll('.sg-btn').forEach(x => x.classList.remove('selected'))
          b.classList.add('selected')
          selectedShotgun = i
          selectedStart = i
        })
        grid.appendChild(b)
      }
    }
  })

  // Invite tabs
  root.querySelectorAll('.invite-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.invite-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      root.querySelectorAll('.invite-panel').forEach(p => p.style.display = 'none')
      root.querySelector(`#invite-${btn.dataset.tab}`).style.display = 'block'
    })
  })

  // SMS preview
  root.querySelector('#sms-send').addEventListener('click', () => {
    const num = root.querySelector('#sms-number').value.trim()
    if (!num) return showToast('Ange ett mobilnummer', 'error')
    const preview = root.querySelector('#sms-preview')
    preview.style.display = 'block'
    preview.innerHTML = `<strong>Förhandsgranskning:</strong><br>"Hej! ${state.profile?.full_name || 'En vän'} bjuder in dig till en golfrunda via BogeyMate. Ladda ner eller titta som gäst: bogeymate.app/join/ABC123"`
    showToast('SMS förberett (backend krävs för utskick)', 'info')
  })

  // Email send
  root.querySelector('#email-send').addEventListener('click', () => {
    const addr = root.querySelector('#email-addr').value.trim()
    if (!addr) return showToast('Ange en e-postadress', 'error')
    showToast('Inbjudan skickad till ' + addr, 'success')
  })

  // Add from app list
  root.querySelectorAll('.invite-add-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('added')) {
        this.classList.remove('added')
        this.textContent = '+ Lägg till'
      } else {
        this.classList.add('added')
        this.textContent = 'Tillagd'
        showToast('Spelare tillagd i rundan', 'success')
      }
    })
  })

  // Start round
  root.querySelector('#start-btn').addEventListener('click', async () => {
    const course = root.querySelector('#course').value.trim()
    const holes  = root.querySelector('#holes').value
    if (!course) return showToast('Ange ett bannamn', 'error')
    const btn = root.querySelector('#start-btn')
    btn.textContent = 'Startar…'; btn.disabled = true
    try {
      const round = await createRound({
        courseName: course,
        holes,
        format: selectedFormat,
        startHole: selectedStart,
        shotgunHole: selectedShotgun || null,
        hostId: state.user.id
      })
      await addPlayerToRound(round.id, state.user.id, state.profile?.handicap || 18)
      state.currentRound = round
      state.currentHole = selectedStart
      showToast('Rundan startad! 🏌️', 'success')
      navigate('round', { currentRound: round })
    } catch (e) {
      showToast('Kunde inte starta rundan: ' + e.message, 'error')
      btn.textContent = 'Starta runda'; btn.disabled = false
    }
  })
}
