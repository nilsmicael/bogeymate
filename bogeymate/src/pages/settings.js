// pages/settings.js
import { updateProfile, signOut } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'
import { renderBottomNav } from '../components/bottom-nav.js'

export function renderSettings(root) {
  const p = state.profile || {}
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Hem</button>
        <h1 class="page-title">Inställningar</h1>
        <div style="width:60px;"></div>
      </div>

      <div class="section-header">Mitt konto</div>
      <div class="card card-list">
        <div class="list-row">
          <div class="avatar av-green">${initials(p.full_name)}</div>
          <div style="flex:1;">
            <div class="row-title">${p.full_name || '–'}</div>
            <div class="row-sub">${state.user?.email || ''} · HCP ${p.handicap || '–'}</div>
          </div>
        </div>
        <div class="list-row" style="gap:8px;">
          <div style="flex:1;">
            <div class="input-row" style="margin-bottom:0;">
              <label>Uppdatera handicap-index</label>
              <div style="display:flex;gap:8px;">
                <input type="number" id="new-hcp" value="${p.handicap || ''}" step="0.1" min="0" max="54" style="flex:1;" />
                <button class="btn-small-green" id="save-hcp">Spara</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-header">Notifikationer</div>
      <div class="card card-list">
        ${toggle('notify_new_round',  'Ny runda startad',      'Notis när en vän startar en runda',            p.notify_new_round)}
        ${toggle('notify_scores',     'Eagle, birdie, ledarbyte', 'Notis vid viktiga poänghändelser',           p.notify_scores)}
        ${toggle('notify_finished',   'Runda avslutad',        'Notis när en runda du följer är klar',         p.notify_finished)}
        ${toggle('notify_invites',    'Inbjudningar',          'Notis när du bjuds in till en runda',          p.notify_invites)}
      </div>

      <div class="section-header">Sekretess</div>
      <div class="card card-list">
        ${toggle('public_rounds',   'Visa mina rundor för alla',  'Alla app-användare kan följa dina rundor',   p.public_rounds)}
        ${toggle('public_profile',  'Visa mig i användarlistor',  'Andra kan hitta dig via namn eller e-post',  p.public_profile)}
      </div>

      <div class="section-header">Banor & GPS</div>
  <div class="card card-list">
    <div class="list-row" id="course-setup-row" style="cursor:pointer;">
      <div style="flex:1;">
        <div class="tl-main">Hantera banor och GPS-punkter</div>
        <div class="tl-sub">Lägg till banor, hämta OSM-data, markera greener</div>
      </div>
      <span style="color:var(--color-muted);">→</span>
    </div>
  </div>

  <div class="section-header">Konto</div>
      <div class="card card-list">
        <div class="list-row" style="cursor:pointer;" id="signout-row">
          <div style="flex:1;font-size:15px;color:#A32D2D;">Logga ut</div>
        </div>
      </div>
    </div>
    ${renderBottomNav('settings')}
  `

  root.querySelector('#back').addEventListener('click', () => navigate('home'))
  root.querySelector('#course-setup-row').addEventListener('click', () => navigate('coursesetup'))

  // Save handicap
  root.querySelector('#save-hcp').addEventListener('click', async () => {
    const val = parseFloat(root.querySelector('#new-hcp').value)
    if (isNaN(val) || val < 0 || val > 54) return showToast('Ange ett giltigt handicap (0–54)', 'error')
    try {
      await updateProfile(state.user.id, { handicap: val })
      if (state.profile) state.profile.handicap = val
      showToast('Handicap uppdaterat ✓', 'success')
    } catch { showToast('Kunde inte spara', 'error') }
  })

  // Toggles
  root.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', async function() {
      this.classList.toggle('on')
      const key = this.dataset.key
      const val = this.classList.contains('on')
      try {
        await updateProfile(state.user.id, { [key]: val })
        if (state.profile) state.profile[key] = val
      } catch { showToast('Kunde inte spara inställning', 'error') }
    })
  })

  // Sign out
  root.querySelector('#signout-row').addEventListener('click', async () => {
    await signOut()
    state.user = null; state.profile = null; state.isGuest = false
    navigate('login')
  })
}

function toggle(key, title, sub, value) {
  return `
    <div class="toggle-row">
      <div class="toggle-label">
        <div class="tl-main">${title}</div>
        <div class="tl-sub">${sub}</div>
      </div>
      <button class="toggle ${value ? 'on' : ''}" data-key="${key}"></button>
    </div>
  `
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
