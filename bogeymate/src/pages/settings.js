// pages/settings.js
import { updateProfile, signOut, getSession } from '../lib/supabase.js'
import { navigate, state, showToast, showFirstLoginTip } from '../main.js'
import { renderBottomNav, wireBottomNav } from '../components/bottom-nav.js'

export async function renderSettings(root) {
  // Always check actual session state
  const session = await getSession()
  const isLoggedIn = !!session
  const p = state.profile || {}

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Hem</button>
        <h1 class="page-title">Inställningar</h1>
        <div style="width:60px;"></div>
      </div>

      ${isLoggedIn ? `
        <div class="section-header">Mitt konto</div>
        <div class="card card-list">
          <div class="list-row" style="cursor:default;">
            <div class="avatar av-green">${initials(p.full_name)}</div>
            <div style="flex:1;">
              <div class="row-title">${p.full_name || session.user.email}</div>
              <div class="row-sub">${session.user.email}</div>
            </div>
          </div>
          <div style="padding:12px 16px; border-bottom: 0.5px solid var(--color-border);">
            <div class="input-row" style="margin-bottom:0;">
              <label>Uppdatera handicap-index</label>
              <div style="display:flex;gap:8px;">
                <input type="number" id="new-hcp" value="${p.handicap||''}" step="0.1" min="0" max="54" style="flex:1;" placeholder="T.ex. 18.4" />
                <button class="btn-small-green" id="save-hcp">Spara</button>
              </div>
            </div>
          </div>
        </div>

        <div class="section-header">Notifikationer</div>
        <div class="card card-list">
          ${toggle('notify_new_round','Ny runda startad','Notis när en vän startar en runda',p.notify_new_round)}
          ${toggle('notify_scores','Eagle, birdie, ledarbyte','Notis vid viktiga poänghändelser',p.notify_scores)}
          ${toggle('notify_finished','Runda avslutad','Notis när en runda du följer är klar',p.notify_finished)}
          ${toggle('notify_invites','Inbjudningar','Notis när du bjuds in till en runda',p.notify_invites)}
        </div>

        <div class="section-header">Sekretess</div>
        <div class="card card-list">
          ${toggle('public_rounds','Visa mina rundor för alla','Alla app-användare kan följa dina rundor',p.public_rounds)}
          ${toggle('public_profile','Visa mig i användarlistor','Andra kan hitta dig via namn eller e-post',p.public_profile)}
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

        <div class="section-header">Skärm & batteri</div>
        <div class="card card-list">
          <div class="toggle-row" style="border-bottom:none;">
            <div class="toggle-label">
              <div class="tl-main">Håll skärmen aktiv</div>
              <div class="tl-sub">Hindrar telefonen från att slockna under rundan</div>
            </div>
            <button class="toggle" id="wake-lock-toggle"></button>
          </div>
        </div>

        <div class="section-header">Hjälp & tips</div>
        <div class="card card-list">
          <div class="list-row" id="show-tips-row" style="cursor:pointer;">
            <div style="flex:1;"><div class="tl-main">Visa välkomsttips igen</div><div class="tl-sub">Bakgrundsläge, hemskärm, offline-läge</div></div>
            <span style="color:var(--color-muted);">→</span>
          </div>
          <div class="list-row" id="show-help-row" style="cursor:pointer; border-bottom:none;">
            <div style="flex:1;"><div class="tl-main">Hjälp & vanliga frågor</div><div class="tl-sub">Svar på de vanligaste frågorna</div></div>
            <span style="color:var(--color-muted);">→</span>
          </div>
        </div>

        <div class="section-header">Hjälp</div>
        <div class="card card-list">
          <div class="list-row" id="help-row" style="cursor:pointer;">
            <div style="flex:1;">
              <div class="tl-main">Hjälp & tips</div>
              <div class="tl-sub">Bakgrundsaktivitet, GPS, offline-läge och vanliga frågor</div>
            </div>
            <span style="color:var(--color-muted);">→</span>
          </div>
        </div>

      <div class="section-header">Konto</div>
        <div class="card card-list">
          <div class="list-row" id="signout-row" style="cursor:pointer;">
            <div style="flex:1;font-size:15px;color:#A32D2D;">Logga ut</div>
          </div>
        </div>
      ` : `
        <div class="card" style="text-align:center; padding:24px 20px; margin-top:20px;">
          <div style="font-size:32px; margin-bottom:12px;">👤</div>
          <div style="font-size:16px; font-weight:500; margin-bottom:8px;">Inte inloggad</div>
          <div style="font-size:14px; color:var(--color-muted); margin-bottom:16px;">Logga in för att se och ändra dina inställningar.</div>
          <button class="btn-primary" style="margin:0;" id="go-login">Gå till inloggning</button>
        </div>
      `}
    </div>
    ${renderBottomNav('settings')}
  `

  root.querySelector('#back').addEventListener('click', () => navigate('home'))
  wireBottomNav()

  if (!isLoggedIn) {
    root.querySelector('#go-login')?.addEventListener('click', () => navigate('login'))
    return
  }

  root.querySelector('#save-hcp')?.addEventListener('click', async () => {
    const val = parseFloat(root.querySelector('#new-hcp').value)
    if (isNaN(val)||val<0||val>54) return showToast('Ange ett giltigt handicap (0–54)','error')
    try {
      await updateProfile(state.user.id, { handicap: val })
      if (state.profile) state.profile.handicap = val
      showToast('Handicap uppdaterat ✓','success')
    } catch { showToast('Kunde inte spara','error') }
  })

  root.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', async function() {
      this.classList.toggle('on')
      const key = this.dataset.key
      const val = this.classList.contains('on')
      try {
        await updateProfile(state.user.id, { [key]: val })
        if (state.profile) state.profile[key] = val
      } catch { showToast('Kunde inte spara inställning','error') }
    })
  })

  root.querySelector('#course-setup-row')?.addEventListener('click', () => navigate('coursesetup'))
  root.querySelector('#help-row')?.addEventListener('click', () => navigate('help'))

  // Wake lock (keep screen on)
  let wakeLock = null
  const wakeToggle = root.querySelector('#wake-lock-toggle')
  if (wakeToggle) {
    const wakeActive = localStorage.getItem('bm_wakelock') === '1'
    if (wakeActive) wakeToggle.classList.add('on')
    wakeToggle.addEventListener('click', async function() {
      this.classList.toggle('on')
      const on = this.classList.contains('on')
      localStorage.setItem('bm_wakelock', on ? '1' : '0')
      if (on && 'wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); showToast('Skärmen hålls aktiv ✓', 'success') }
        catch { showToast('Kunde inte aktivera — tillåt i telefonens inställningar', 'error') }
      } else if (wakeLock) { wakeLock.release(); wakeLock = null }
    })
  }

  root.querySelector('#show-tips-row')?.addEventListener('click', () => {
    localStorage.removeItem('bm_tip_shown')
    showFirstLoginTip()
  })

  root.querySelector('#show-help-row')?.addEventListener('click', () => {
    showHelpDialog()
  })

  root.querySelector('#signout-row')?.addEventListener('click', async () => {
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
      <button class="toggle ${value?'on':''}" data-key="${key}"></button>
    </div>
  `
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
}

function showHelpDialog() {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:var(--color-bg,#fff);border-radius:16px 16px 0 0;padding:24px 20px 32px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;">
      <div style="font-size:18px;font-weight:500;margin-bottom:16px;">Hjälp & vanliga frågor</div>
      <div style="font-size:14px;line-height:1.7;color:#444;">
        <p style="margin-bottom:12px;"><strong>Appen försvinner när jag gör något annat</strong><br>
        Aktivera "Håll skärmen aktiv" under Inställningar → Skärm & batteri. På Android: gå till Inställningar → Appar → Chrome → Batteri → Ingen begränsning.</p>

        <p style="margin-bottom:12px;"><strong>iPhone: appen måste öppnas i Safari</strong><br>
        För att lägga till appen på hemskärmen måste du använda Safari, inte Chrome. Öppna länken i Safari, tryck dela-knappen (rutan med pilen uppåt) och välj "Lägg till på hemskärmen".</p>

        <p style="margin-bottom:12px;"><strong>Android: lägg till på startskärmen</strong><br>
        Öppna länken i Chrome, tryck de tre prickarna uppe till höger och välj "Lägg till på startskärmen" eller "Installera app".</p>

        <p style="margin-bottom:12px;"><strong>Appen fungerar utan internet</strong><br>
        Slag sparas lokalt och laddas upp automatiskt när signalen är tillbaka. En gul indikator visas när du är offline.</p>

        <p style="margin-bottom:12px;"><strong>Glömt lösenordet?</strong><br>
        På inloggningsskärmen finns "Glömt lösenordet?" — tryck där så skickas en återställningslänk till din e-post.</p>

        <p style="margin-bottom:12px;"><strong>Hur bjuder jag in en vän?</strong><br>
        Under "Ny runda" → fliken "App-användare" kan du söka på namn. Eller skicka appen länk via SMS-fliken.</p>

        <p><strong>Hur registrerar jag mitt handicap?</strong><br>
        BogeyMate beräknar rätt Stableford-poäng att registrera. Gå till MinGolf.golf.se efter rundan och ange poängen du ser under HCP-fliken i rundan.</p>
      </div>
      <button id="help-close" style="width:100%;padding:13px;margin-top:16px;border:none;border-radius:12px;background:#1D9E75;color:#fff;font-size:15px;font-weight:500;cursor:pointer;">Stäng</button>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.querySelector('#help-close').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove() })
}
