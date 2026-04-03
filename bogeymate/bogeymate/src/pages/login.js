// pages/login.js
import { signIn, signUp, supabase } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'

export function renderLogin(root) {
  root.innerHTML = `
    <div class="page page-login">
      <div class="login-hero">
        <div class="login-icon-bg">
          <span class="login-big-icon">⛳</span>
        </div>
        <h1 class="app-name">BogeyMate</h1>
        <p class="app-tagline">Din trogna kompis i misären</p>
        <p class="app-sub">Följ dina vänner live på banan</p>
      </div>

      <div id="login-form">
        <div class="card">
          <div class="input-row">
            <label>E-post</label>
            <input type="email" id="email" placeholder="din@epost.se" autocomplete="email" />
          </div>
          <div class="input-row" style="margin-bottom:0;">
            <label>Lösenord</label>
            <div class="pw-wrap">
              <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" />
              <button class="pw-eye" id="pw-eye" tabindex="-1">👁</button>
            </div>
          </div>
        </div>
        <button class="btn-primary" id="login-btn">Logga in</button>
        <div style="text-align:center; margin-bottom:8px;">
          <button class="link-btn" id="show-reset">Glömt lösenordet?</button>
        </div>
        <button class="btn-secondary" id="show-signup">Skapa konto</button>
        <div style="text-align:center; padding:4px 0 16px;">
          <button class="link-btn" id="guest-btn">Fortsätt som gäst (titta på rundor)</button>
        </div>
      </div>

      <div id="signup-form" style="display:none;">
        <div class="card">
          <div class="input-row"><label>Namn</label><input type="text" id="su-name" placeholder="Förnamn Efternamn" /></div>
          <div class="input-row"><label>E-post</label><input type="email" id="su-email" placeholder="din@epost.se" /></div>
          <div class="input-row">
            <label>Lösenord (minst 6 tecken)</label>
            <div class="pw-wrap">
              <input type="password" id="su-password" placeholder="••••••••" autocomplete="new-password" />
              <button class="pw-eye" id="su-pw-eye" tabindex="-1">👁</button>
            </div>
          </div>
          <div class="input-row" style="margin-bottom:0;"><label>Handicap-index</label><input type="number" id="su-hcp" placeholder="18.4" step="0.1" min="0" max="54" /></div>
        </div>
        <button class="btn-primary" id="signup-btn">Skapa konto</button>
        <button class="btn-secondary" id="back-from-signup">← Tillbaka till inloggning</button>
      </div>

      <div id="reset-form" style="display:none;">
        <div class="card">
          <p style="font-size:14px;color:var(--color-muted);margin-bottom:12px;line-height:1.5;">Skriv in din e-postadress så skickar vi en länk för att välja ett nytt lösenord.</p>
          <div class="input-row" style="margin-bottom:0;"><label>E-post</label><input type="email" id="reset-email" placeholder="din@epost.se" /></div>
        </div>
        <button class="btn-primary" id="reset-btn">Skicka återställningslänk</button>
        <button class="btn-secondary" id="back-from-reset">← Tillbaka till inloggning</button>
      </div>

      <div id="confirm-notice" style="display:none;">
        <div class="card" style="text-align:center;padding:24px 20px;">
          <div style="font-size:40px;margin-bottom:12px;">📧</div>
          <div style="font-size:16px;font-weight:500;margin-bottom:8px;" id="confirm-title">Kolla din e-post!</div>
          <div style="font-size:14px;color:var(--color-muted);line-height:1.6;margin-bottom:12px;" id="confirm-body">Vi har skickat ett bekräftelsemejl. Klicka på länken i mejlet för att aktivera ditt konto, sedan kan du logga in här.</div>
          <div style="font-size:12px;color:var(--color-muted);">Kolla även skräppost-mappen om mejlet inte dyker upp.</div>
        </div>
        <button class="btn-primary" id="back-from-confirm">Gå till inloggning</button>
      </div>
    </div>
  `

  function showOnly(id) {
    ['login-form','signup-form','reset-form','confirm-notice'].forEach(f => {
      root.querySelector('#'+f).style.display = f===id ? 'block' : 'none'
    })
  }

  function wireEye(eyeId, inputId) {
    root.querySelector('#'+eyeId).addEventListener('click', () => {
      const inp = root.querySelector('#'+inputId)
      inp.type = inp.type==='password' ? 'text' : 'password'
    })
  }
  wireEye('pw-eye','password')
  wireEye('su-pw-eye','su-password')

  root.querySelector('#show-signup').addEventListener('click', () => showOnly('signup-form'))
  root.querySelector('#back-from-signup').addEventListener('click', () => showOnly('login-form'))
  root.querySelector('#show-reset').addEventListener('click', () => showOnly('reset-form'))
  root.querySelector('#back-from-reset').addEventListener('click', () => showOnly('login-form'))
  root.querySelector('#back-from-confirm').addEventListener('click', () => showOnly('login-form'))

  root.querySelector('#password').addEventListener('keydown', e => {
    if (e.key==='Enter') root.querySelector('#login-btn').click()
  })

  root.querySelector('#login-btn').addEventListener('click', async () => {
    const email = root.querySelector('#email').value.trim()
    const pw    = root.querySelector('#password').value
    if (!email||!pw) return showToast('Fyll i e-post och lösenord','error')
    const btn = root.querySelector('#login-btn')
    btn.textContent='Loggar in…'; btn.disabled=true
    try {
      state.user = await signIn(email, pw)
      navigate('home')
    } catch(e) {
      const msg = (e.message||'').includes('Email not confirmed')
        ? 'Bekräfta din e-post först — kolla din inkorg (och skräppost)'
        : 'Fel e-post eller lösenord'
      showToast(msg,'error')
      btn.textContent='Logga in'; btn.disabled=false
    }
  })

  root.querySelector('#signup-btn').addEventListener('click', async () => {
    const name = root.querySelector('#su-name').value.trim()
    const email= root.querySelector('#su-email').value.trim()
    const pw   = root.querySelector('#su-password').value
    const hcp  = root.querySelector('#su-hcp').value
    if (!name||!email||!pw||!hcp) return showToast('Fyll i alla fält','error')
    if (pw.length<6) return showToast('Lösenordet måste vara minst 6 tecken','error')
    const btn = root.querySelector('#signup-btn')
    btn.textContent='Skapar konto…'; btn.disabled=true
    try {
      await signUp(email, pw, name, hcp)
      showOnly('confirm-notice')
    } catch(e) {
      showToast(e.message||'Något gick fel','error')
      btn.textContent='Skapa konto'; btn.disabled=false
    }
  })

  root.querySelector('#reset-btn').addEventListener('click', async () => {
    const email = root.querySelector('#reset-email').value.trim()
    if (!email) return showToast('Ange din e-postadress','error')
    const btn = root.querySelector('#reset-btn')
    btn.textContent='Skickar…'; btn.disabled=true
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      if (error) throw error
      root.querySelector('#confirm-title').textContent = 'Återställningslänk skickad!'
      root.querySelector('#confirm-body').textContent  = 'Kolla din e-post och klicka på länken för att välja ett nytt lösenord.'
      showOnly('confirm-notice')
    } catch(e) {
      showToast('Kunde inte skicka återställningslänk','error')
      btn.textContent='Skicka återställningslänk'; btn.disabled=false
    }
  })

  root.querySelector('#guest-btn').addEventListener('click', () => {
    state.isGuest=true
    navigate('home')
  })
}
