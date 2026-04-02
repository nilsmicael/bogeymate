// pages/login.js
import { signIn, signUp } from '../lib/supabase.js'
import { navigate, state, showToast } from '../main.js'

export function renderLogin(root) {
  root.innerHTML = `
    <div class="page page-login">
      <div class="login-hero">
        <div class="app-icon">⛳</div>
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
            <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" />
          </div>
        </div>
        <button class="btn-primary" id="login-btn">Logga in</button>
        <button class="btn-secondary" id="show-signup">Skapa konto</button>
        <div style="text-align:center;padding:4px 0;">
          <button class="link-btn" id="guest-btn">Fortsätt som gäst (titta på rundor)</button>
        </div>
      </div>

      <div id="signup-form" style="display:none;">
        <div class="card">
          <div class="input-row">
            <label>Namn</label>
            <input type="text" id="su-name" placeholder="Förnamn Efternamn" />
          </div>
          <div class="input-row">
            <label>E-post</label>
            <input type="email" id="su-email" placeholder="din@epost.se" />
          </div>
          <div class="input-row">
            <label>Lösenord (minst 6 tecken)</label>
            <input type="password" id="su-password" placeholder="••••••••" />
          </div>
          <div class="input-row" style="margin-bottom:0;">
            <label>Handicap-index</label>
            <input type="number" id="su-hcp" placeholder="18.4" step="0.1" min="0" max="54" />
          </div>
        </div>
        <button class="btn-primary" id="signup-btn">Skapa konto</button>
        <button class="btn-secondary" id="show-login">Tillbaka till inloggning</button>
      </div>
    </div>
  `

  // Toggle forms
  root.querySelector('#show-signup').addEventListener('click', () => {
    root.querySelector('#login-form').style.display = 'none'
    root.querySelector('#signup-form').style.display = 'block'
  })
  root.querySelector('#show-login').addEventListener('click', () => {
    root.querySelector('#signup-form').style.display = 'none'
    root.querySelector('#login-form').style.display = 'block'
  })

  // Login
  root.querySelector('#login-btn').addEventListener('click', async () => {
    const email    = root.querySelector('#email').value.trim()
    const password = root.querySelector('#password').value
    if (!email || !password) return showToast('Fyll i e-post och lösenord', 'error')
    const btn = root.querySelector('#login-btn')
    btn.textContent = 'Loggar in…'; btn.disabled = true
    try {
      state.user = await signIn(email, password)
      navigate('home')
    } catch (e) {
      showToast('Fel e-post eller lösenord', 'error')
      btn.textContent = 'Logga in'; btn.disabled = false
    }
  })

  // Sign up
  root.querySelector('#signup-btn').addEventListener('click', async () => {
    const name     = root.querySelector('#su-name').value.trim()
    const email    = root.querySelector('#su-email').value.trim()
    const password = root.querySelector('#su-password').value
    const hcp      = root.querySelector('#su-hcp').value
    if (!name || !email || !password || !hcp) return showToast('Fyll i alla fält', 'error')
    const btn = root.querySelector('#signup-btn')
    btn.textContent = 'Skapar konto…'; btn.disabled = true
    try {
      state.user = await signUp(email, password, name, hcp)
      showToast('Välkommen till BogeyMate! 🎉', 'success')
      navigate('home')
    } catch (e) {
      showToast(e.message || 'Något gick fel', 'error')
      btn.textContent = 'Skapa konto'; btn.disabled = false
    }
  })

  // Guest
  root.querySelector('#guest-btn').addEventListener('click', () => {
    state.isGuest = true
    navigate('home')
  })
}
