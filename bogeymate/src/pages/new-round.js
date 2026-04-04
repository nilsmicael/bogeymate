// pages/new-round.js
import { createRound, addPlayerToRound, getProfile, searchProfiles,
         getCourseTees, upsertCourseTee, getFavoriteCoursesForUser } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { FORMAT_DESCRIPTIONS } from '../lib/golf.js'
import { renderBottomNav, wireBottomNav } from '../components/bottom-nav.js'

const ALL_FORMATS = {
  ...FORMAT_DESCRIPTIONS,
  lagmatchspel: { label: 'Lagmatchspel', desc: 'Lag mot lag (Ryder Cup-stil). Hål poängsätts per lag.' }
}

const TEE_COLORS = [
  { color: 'gul',   label: 'Gul (herr)',    bg: '#FAEEDA', text: '#854F0B' },
  { color: 'rod',   label: 'Röd (dam)',      bg: '#FCEBEB', text: '#A32D2D' },
  { color: 'vit',   label: 'Vit',           bg: '#F5F5F3', text: '#444' },
  { color: 'bla',   label: 'Blå',           bg: '#E6F1FB', text: '#185FA5' },
  { color: 'svart', label: 'Svart (pro)',    bg: '#2C2C2A', text: '#fff' }
]

export async function renderNewRound(root) {
  // Load favorite courses
  let favCourses = []
  if (state.user) {
    try { favCourses = await getFavoriteCoursesForUser(state.user.id) } catch {}
  }

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Ny runda</h1>
        <div style="width:60px;"></div>
      </div>

      <!-- Course selection -->
      <div class="section-header" style="margin-top:0;">Bana</div>
      ${favCourses.length ? `
        <div style="padding:0 16px;margin-bottom:8px;">
          <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px;">Senast spelade banor</div>
          <div style="display:flex;flex-direction:column;gap:6px;" id="fav-list">
            ${favCourses.map((c,i) => `
              <button class="fav-course-btn ${i===0?'selected':''}" data-cname="${c.name}" data-cid="${c.id||''}">
                ${i===0?'⭐ ':''}${c.name}
                <span style="font-size:11px;opacity:.6;margin-left:4px;">${c.count} runda${c.count!==1?'r':''}</span>
              </button>
            `).join('')}
            <button class="fav-course-btn" data-cname="" data-cid="" id="other-course-btn">+ Annan bana…</button>
          </div>
        </div>
      ` : ''}
      <div class="form-section" id="course-input-wrap" style="${favCourses.length?'display:none;':''}">
        <div class="input-row"><label>Golfklubb / bana</label><input type="text" id="course" placeholder="T.ex. Sunne GK" /></div>
      </div>
      <div style="padding:0 16px;font-size:12px;color:var(--color-muted);margin-bottom:4px;" id="selected-course-label"></div>

      <!-- Tee / slope -->
      <div class="section-header">Tee-val</div>
      <div style="padding:0 16px;margin-bottom:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;" id="tee-btns">
          ${TEE_COLORS.map((t,i) => `
            <button class="tee-color-btn ${i===0?'selected':''}" data-tcolor="${t.color}" data-tlabel="${t.label}"
              style="background:${t.bg};color:${t.text};border-color:${t.bg};">
              ${t.label}
            </button>
          `).join('')}
        </div>
        <div id="slope-status" class="info-box" style="display:none;font-size:13px;"></div>
        <div id="slope-inputs" style="display:none;">
          <div style="font-size:13px;color:var(--color-muted);margin-bottom:8px;line-height:1.5;">
            Första gången på denna bana och tee — ange slope och course rating en gång så sparas det automatiskt för framtiden. Hittas på scorekortet eller på <strong>sgf.golf.se</strong>.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="input-row" style="margin-bottom:0;">
              <label>Slope</label>
              <input type="number" id="slope" placeholder="113" min="55" max="155" value="113" />
            </div>
            <div class="input-row" style="margin-bottom:0;">
              <label>Course rating</label>
              <input type="number" id="course-rating" placeholder="72.0" step="0.1" value="72.0" />
            </div>
          </div>
        </div>
      </div>

      <!-- Holes and format -->
      <div class="section-header">Inställningar</div>
      <div class="form-section">
        <div class="input-row">
          <label>Antal hål</label>
          <select id="holes"><option value="18">18 hål</option><option value="9">9 hål</option><option value="12">12 hål</option></select>
        </div>
      </div>

      <div class="section-header">Spelform</div>
      <div class="format-grid" id="format-grid">
        ${Object.entries(ALL_FORMATS).map(([key, f]) => `
          <div class="fmt-opt ${key==='stableford'?'selected':''}" data-fmt="${key}">
            <div class="fo-name">${f.label}</div>
            <div class="fo-desc">${f.desc}</div>
          </div>
        `).join('')}
      </div>

      <!-- Start hole -->
      <div class="section-header">Starthål</div>
      <div class="start-grid">
        <div class="start-opt selected" id="so-1" data-hole="1"><div class="so-num">Hål 1</div><div class="so-label">Vanlig start</div></div>
        <div class="start-opt" id="so-10" data-hole="10"><div class="so-num">Hål 10</div><div class="so-label">Bakre nio</div></div>
      </div>
      <div class="form-section">
        <button class="btn-outline" id="shotgun-toggle">🎯 Shotgun-start — välj valfritt starthål</button>
      </div>
      <div id="shotgun-panel" style="display:none;margin-bottom:4px;">
        <div style="padding:0 16px;font-size:12px;color:var(--color-muted);margin-bottom:8px;">Välj vilket hål du börjar på:</div>
        <div class="shotgun-grid" id="sg-grid"></div>
      </div>

      <!-- Players -->
      <div class="section-header">Spelare och handicap</div>
      <div class="card card-list" id="player-list" style="margin-bottom:8px;">
        <div class="list-row" style="cursor:default;">
          <div class="avatar av-green">${initials(state.profile?.full_name)}</div>
          <div style="flex:1;">
            <div class="row-title">${state.profile?.full_name||'Du'} (värd)</div>
            <div class="row-sub">HCP-index: ${state.profile?.handicap||'–'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--color-muted);">Spelhandicap</div>
            <div style="font-size:16px;font-weight:500;color:#1D9E75;" id="my-playing-hcp">${state.profile?.handicap ? Math.round(state.profile.handicap) : '–'}</div>
          </div>
        </div>
      </div>

      <!-- Invite -->
      <div class="section-header">Bjud in spelare</div>
      <div class="invite-tabs">
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
        <div style="padding:0 16px 4px;">
          <div class="input-row">
            <label>Sök efter användare</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="user-search" placeholder="Namn eller e-post" style="flex:1;" />
              <button class="btn-small-green" id="user-search-btn">Sök</button>
            </div>
          </div>
          <div id="user-search-results"></div>
          <div style="font-size:12px;color:var(--color-muted);margin-top:4px;">Användaren måste ha ett BogeyMate-konto.</div>
        </div>
      </div>

      <button class="btn-primary" id="start-btn">Starta runda</button>
    </div>
    ${renderBottomNav('newround')}
  `

  let selectedFormat  = 'stableford'
  let selectedStart   = 1
  let selectedShotgun = 0
  let selectedTee     = TEE_COLORS[0]
  let selectedCourseName = favCourses[0]?.name || ''
  let selectedCourseId   = favCourses[0]?.id   || null
  const invitedUsers = []

  // Saved tee data cache: { 'courseId_teecolor': { slope, rating } }
  let savedTees = {}
  let currentSlope = 113
  let currentRating = 72.0

  function updatePlayingHcp() {
    const hcpIndex = state.profile?.handicap || 0
    const ph = Math.round(hcpIndex * (currentSlope / 113) + (currentRating - 72))
    const el = root.querySelector('#my-playing-hcp')
    if (el) el.textContent = ph
  }

  async function loadTeesForCourse(courseId) {
    if (!courseId) return
    try {
      const { getCourseTees: gct } = await import('../lib/supabase.js')
      const tees = await gct(courseId)
      savedTees = {}
      for (const t of tees) {
        savedTees[courseId + '_' + t.tee_color] = { slope: t.slope, rating: t.course_rating, label: t.tee_label }
      }
      // Trigger update for currently selected tee
      applyTeeData(courseId, selectedTee.color)
    } catch {}
  }

  function applyTeeData(courseId, teeColor) {
    const key = courseId + '_' + teeColor
    const saved = savedTees[key]
    const statusEl = root.querySelector('#slope-status')
    const inputsEl = root.querySelector('#slope-inputs')
    if (saved) {
      // Auto-fill from saved data
      currentSlope  = saved.slope
      currentRating = saved.rating
      if (statusEl) {
        statusEl.style.display = 'block'
        statusEl.innerHTML = `✓ Slope <strong>${saved.slope}</strong> · Course rating <strong>${saved.rating}</strong> — sparade värden för ${saved.label}`
        statusEl.style.background = '#E1F5EE'
        statusEl.style.color = '#0F6E56'
      }
      if (inputsEl) inputsEl.style.display = 'none'
    } else {
      // No saved data — show input fields
      currentSlope  = 113
      currentRating = 72.0
      if (statusEl) statusEl.style.display = 'none'
      if (inputsEl) inputsEl.style.display = 'block'
    }
    updatePlayingHcp()
  }

  root.querySelector('#slope')?.addEventListener('input', () => {
    currentSlope = parseInt(root.querySelector('#slope').value) || 113
    updatePlayingHcp()
  })
  root.querySelector('#course-rating')?.addEventListener('input', () => {
    currentRating = parseFloat(root.querySelector('#course-rating').value) || 72.0
    updatePlayingHcp()
  })

  // Favorite course selection
  root.querySelectorAll('.fav-course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.fav-course-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      if (btn.id === 'other-course-btn') {
        root.querySelector('#course-input-wrap').style.display = 'block'
        selectedCourseName = ''
        selectedCourseId   = null
        root.querySelector('#selected-course-label').textContent = ''
        // Clear tee data since no course selected
        root.querySelector('#slope-status').style.display = 'none'
        root.querySelector('#slope-inputs').style.display = 'block'
      } else {
        root.querySelector('#course-input-wrap').style.display = 'none'
        selectedCourseName = btn.dataset.cname
        selectedCourseId   = btn.dataset.cid || null
        root.querySelector('#selected-course-label').textContent = '📍 ' + selectedCourseName
        if (selectedCourseId) loadTeesForCourse(selectedCourseId)
      }
    })
  })

  // Tee color selection
  root.querySelectorAll('.tee-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tee-color-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedTee = TEE_COLORS.find(t => t.color === btn.dataset.tcolor) || TEE_COLORS[0]
      if (selectedCourseId) applyTeeData(selectedCourseId, selectedTee.color)
    })
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
    const open  = panel.style.display === 'block'
    panel.style.display = open ? 'none' : 'block'
    if (!open) {
      root.querySelectorAll('.start-opt').forEach(e => e.classList.remove('selected'))
      const grid = root.querySelector('#sg-grid'); grid.innerHTML = ''
      for (let i = 1; i <= 18; i++) {
        const b = document.createElement('button'); b.className='sg-btn'; b.textContent=i
        b.addEventListener('click', () => {
          root.querySelectorAll('.sg-btn').forEach(x=>x.classList.remove('selected'))
          b.classList.add('selected'); selectedShotgun=i; selectedStart=i
        })
        grid.appendChild(b)
      }
    }
  })

  // Invite tabs
  root.querySelectorAll('.invite-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.invite-tab').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      root.querySelectorAll('.invite-panel').forEach(p=>p.style.display='none')
      root.querySelector(`#invite-${btn.dataset.tab}`).style.display='block'
    })
  })

  // SMS
  root.querySelector('#sms-send').addEventListener('click', () => {
    const num = root.querySelector('#sms-number').value.trim()
    if (!num) return showToast('Ange ett mobilnummer','error')
    const prev = root.querySelector('#sms-preview')
    prev.style.display='block'
    prev.innerHTML=`<strong>Förhandsgranskning:</strong><br>"Hej! ${state.profile?.full_name||'En vän'} bjuder in dig till en golfrunda via BogeyMate. Ladda ner eller titta som gäst: bogeymate.app/join/ABC123"`
    showToast('SMS förberett','info')
  })

  // Email
  root.querySelector('#email-send').addEventListener('click', () => {
    const addr = root.querySelector('#email-addr').value.trim()
    if (!addr) return showToast('Ange en e-postadress','error')
    showToast('Inbjudan skickad till '+addr,'success')
  })

  // User search
  root.querySelector('#user-search-btn')?.addEventListener('click', async () => {
    const q = root.querySelector('#user-search')?.value?.trim()
    if (!q||q.length<2) return showToast('Skriv minst 2 tecken','info')
    const resultsEl = root.querySelector('#user-search-results')
    resultsEl.innerHTML = '<div style="font-size:13px;color:var(--color-muted);padding:8px 0;">Söker…</div>'
    try {
      const users = await searchProfiles(q)
      if (!users.length) { resultsEl.innerHTML='<div style="font-size:13px;color:var(--color-muted);padding:8px 0;">Ingen hittades.</div>'; return }
      resultsEl.innerHTML = '<div class="card card-list" style="margin:8px 0 0;">' +
        users.map(u=>`
          <div class="list-row" style="cursor:default;">
            <div class="avatar av-green">${initials(u.full_name)}</div>
            <div style="flex:1;"><div class="row-title">${u.full_name}</div><div class="row-sub">HCP ${u.handicap||'–'}</div></div>
            <button class="invite-add-btn" data-uid="${u.id}" data-name="${u.full_name}" data-hcp="${u.handicap||18}">+ Lägg till</button>
          </div>`).join('') + '</div>'
      resultsEl.querySelectorAll('.invite-add-btn').forEach(btn=>{
        btn.addEventListener('click', function(){
          if (!invitedUsers.find(u=>u.id===this.dataset.uid)) {
            invitedUsers.push({ id:this.dataset.uid, name:this.dataset.name, hcp:parseFloat(this.dataset.hcp)||18 })
            this.textContent='Tillagd'; this.classList.add('added')
            showToast(this.dataset.name+' tillagd i rundan','success')
          }
        })
      })
    } catch { resultsEl.innerHTML='<div style="font-size:13px;color:#A32D2D;padding:8px 0;">Sökning misslyckades.</div>' }
  })
  root.querySelector('#user-search')?.addEventListener('keydown', e=>{ if(e.key==='Enter') root.querySelector('#user-search-btn')?.click() })

  // Start round
  root.querySelector('#start-btn').addEventListener('click', async () => {
    const courseName = selectedCourseName || root.querySelector('#course')?.value?.trim()
    const holes      = parseInt(root.querySelector('#holes').value)
    const slope      = parseInt(root.querySelector('#slope').value) || 113
    const rating     = parseFloat(root.querySelector('#course-rating').value) || 72.0
    if (!courseName) return showToast('Välj eller ange en bana','error')
    const btn = root.querySelector('#start-btn')
    btn.textContent='Startar…'; btn.disabled=true
    try {
      const { createRound: cr } = await import('../lib/supabase.js')
      const round = await createRound({
        courseName, holes, format: selectedFormat,
        startHole: selectedStart, shotgunHole: selectedShotgun||null,
        hostId: state.user.id
      })
      // Save tee/slope — always try if we have a courseId and data was manually entered
      const wasManual = root.querySelector('#slope-inputs')?.style.display !== 'none'
      if (selectedCourseId && wasManual) {
        try {
          await upsertCourseTee(selectedCourseId, {
            tee_color: selectedTee.color, tee_label: selectedTee.label,
            slope, course_rating: rating, par: 72
          })
        } catch {}
      }
      const hcpIndex  = state.profile?.handicap || 18
      const playingHcp = Math.round(hcpIndex * (slope/113) + (rating-72))
      await addPlayerToRound(round.id, state.user.id, playingHcp)
      for (const u of invitedUsers) {
        const ph = Math.round((u.hcp||18) * (slope/113) + (rating-72))
        await addPlayerToRound(round.id, u.id, ph)
      }
      state.currentRound = round
      state.currentHole  = selectedStart
      showToast('Rundan startad! 🏌️','success')
      navigate('round', { currentRound: round })
    } catch(e) {
      showToast('Kunde inte starta rundan: '+e.message,'error')
      btn.textContent='Starta runda'; btn.disabled=false
    }
  })

  root.querySelector('#back').addEventListener('click', () => navigate('home'))
  wireBottomNav()
  updatePlayingHcp()
  // Auto-load tees for pre-selected course
  if (selectedCourseId) loadTeesForCourse(selectedCourseId)
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
}
