// pages/help.js — Help center and first-run tips
import { navigate, state } from '../main.js'

const FIRST_RUN_KEY = 'bm_first_run_done'

export function checkFirstRun(root) {
  if (localStorage.getItem(FIRST_RUN_KEY)) return
  showWelcomeGuide(root)
}

export function showWelcomeGuide(root) {
  const overlay = document.createElement('div')
  overlay.id = 'welcome-overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;
    display:flex;align-items:flex-end;justify-content:center;
  `
  overlay.innerHTML = `
    <div style="background:var(--color-bg);border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:36px;margin-bottom:8px;">⛳</div>
        <div style="font-size:20px;font-weight:500;margin-bottom:4px;">Välkommen till BogeyMate!</div>
        <div style="font-size:14px;color:var(--color-muted);">Tre viktiga tips innan du börjar</div>
      </div>

      <div class="help-tip-card">
        <div class="help-tip-icon">📱</div>
        <div>
          <div class="help-tip-title">Håll appen aktiv i bakgrunden</div>
          <div class="help-tip-body">
            <strong>iPhone:</strong> Inställningar → Skärmtid → Alltid tillåtna → lägg till BogeyMate. Eller: Inställningar → Batteri → stäng av Lågenergiläge under runden.<br><br>
            <strong>Android:</strong> Inställningar → Appar → BogeyMate → Batteri → Ingen begränsning (eller "Obegränsad"). På Samsung: Inställningar → Enhetsunderhåll → Batteri → BogeyMate → Tillåt bakgrundsaktivitet.
          </div>
        </div>
      </div>

      <div class="help-tip-card">
        <div class="help-tip-icon">📡</div>
        <div>
          <div class="help-tip-title">Fungerar utan internet</div>
          <div class="help-tip-body">Om du tappar signal på banan sparas dina slag automatiskt och laddas upp när du får uppkoppling igen. En orange indikator visas om du är offline.</div>
        </div>
      </div>

      <div class="help-tip-card" style="border-bottom:none;">
        <div class="help-tip-icon">⛳</div>
        <div>
          <div class="help-tip-title">GPS-avstånd till green</div>
          <div class="help-tip-body">Tryck på 📡-knappen när du matar in slag för att se avstånd till greenen. Första gången behöver du markera greenerna på banan — görs en gång och gäller för alla.</div>
        </div>
      </div>

      <button id="welcome-close" style="display:block;width:100%;margin-top:20px;padding:14px;background:#1D9E75;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;">
        Kom igång!
      </button>
      <div style="text-align:center;margin-top:10px;">
        <button id="welcome-help" style="background:none;border:none;color:var(--color-muted);font-size:13px;cursor:pointer;">
          Visa fler tips i Inställningar →
        </button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.querySelector('#welcome-close').addEventListener('click', () => {
    overlay.remove()
    localStorage.setItem(FIRST_RUN_KEY, '1')
  })
  overlay.querySelector('#welcome-help').addEventListener('click', () => {
    overlay.remove()
    localStorage.setItem(FIRST_RUN_KEY, '1')
    navigate('help')
  })
}

export function renderHelp(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Inställningar</button>
        <h1 class="page-title">Hjälp & tips</h1>
        <div style="width:60px;"></div>
      </div>

      <div class="section-header" style="margin-top:0;">Håll appen aktiv på banan</div>
      <div class="card" style="margin-bottom:10px;">
        <div class="help-tip-card" style="padding:0 0 14px;">
          <div class="help-tip-icon">🍎</div>
          <div>
            <div class="help-tip-title">iPhone</div>
            <div class="help-tip-body">
              1. Öppna <strong>Inställningar</strong> på din iPhone<br>
              2. Scrolla ner och tryck på <strong>Batteri</strong><br>
              3. Stäng av <strong>Lågenergiläge</strong> om det är påslaget<br>
              4. Gå tillbaka och tryck på <strong>Skärmtid → Alltid tillåtna</strong><br>
              5. Tryck på + och lägg till BogeyMate<br><br>
              <em>Alternativ:</em> Håll skärmen aktiv under runden genom att inte trycka på strömknappen.
            </div>
          </div>
        </div>
        <div class="help-tip-card" style="padding:14px 0 0;border-top:0.5px solid var(--color-border);border-bottom:none;">
          <div class="help-tip-icon">🤖</div>
          <div>
            <div class="help-tip-title">Android</div>
            <div class="help-tip-body">
              1. Öppna <strong>Inställningar</strong><br>
              2. Tryck på <strong>Appar</strong> (eller Apphanteraren)<br>
              3. Hitta och tryck på <strong>BogeyMate</strong><br>
              4. Tryck på <strong>Batteri</strong><br>
              5. Välj <strong>Ingen begränsning</strong> eller <strong>Obegränsad</strong><br><br>
              <em>Samsung:</em> Inställningar → Enhetsunderhåll → Batteri → tryck på BogeyMate → Tillåt bakgrundsaktivitet.
            </div>
          </div>
        </div>
      </div>

      <div class="section-header">GPS och avstånd</div>
      <div class="card help-tip-card" style="border-bottom:none;">
        <div class="help-tip-icon">📡</div>
        <div>
          <div class="help-tip-title">Hur GPS-avståndet fungerar</div>
          <div class="help-tip-body">
            Tryck på 📡-knappen när du matar in slag. För att GPS ska fungera på en bana behöver greenerna markeras en gång — gå till Inställningar → Banor & GPS → välj din bana. Under en runda kan du markera varje green när du är på plats.
          </div>
        </div>
      </div>

      <div class="section-header">Offline-läge</div>
      <div class="card help-tip-card" style="border-bottom:none;">
        <div class="help-tip-icon">📶</div>
        <div>
          <div class="help-tip-title">Fungerar utan internet</div>
          <div class="help-tip-body">
            BogeyMate sparar dina slag lokalt om du tappar signal. En orange rad visas längst ner om du är offline. Slag laddas upp automatiskt när du får uppkoppling igen — du behöver inte göra något.
          </div>
        </div>
      </div>

      <div class="section-header">Handicap och slope</div>
      <div class="card help-tip-card" style="border-bottom:none;">
        <div class="help-tip-icon">🧮</div>
        <div>
          <div class="help-tip-title">Spelhandicap beräknas automatiskt</div>
          <div class="help-tip-body">
            BogeyMate beräknar ditt spelhandicap baserat på ditt handicapindex och banans slope. Du kan justera handicap per spelare när du startar en runda. Kom ihåg att hålla ditt handicapindex uppdaterat under Inställningar → Mitt konto.
          </div>
        </div>
      </div>

      <div class="section-header">Vanliga frågor</div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
        ${faq('Varför syns inte mina vänner i leaderboarden?', 'De behöver ett eget BogeyMate-konto och måste vara med i samma runda. Bjud in dem via SMS eller e-post när du startar rundan.')}
        ${faq('Hur ändrar jag mitt handicap?', 'Gå till Inställningar → Mitt konto → Uppdatera handicap-index. Du kan också justera det för en enskild runda när du startar den.')}
        ${faq('Kan jag spela utan att registrera slag?', 'Ja — starta en runda och välj Spektator-läge, eller följ en annan bolls runda under pågående spel via 👁-knappen.')}
        ${faq('Appen stängs av på banan — vad gör jag?', 'Se avsnittet "Håll appen aktiv på banan" ovan. Kortaste lösningen: stäng av Lågenergiläge på iPhone, eller sätt BogeyMate på "Ingen begränsning" i batteriinställningarna på Android.')}
      </div>

      <div style="text-align:center;padding:0 16px 16px;">
        <button class="link-btn" id="show-welcome">Visa välkomstguiden igen</button>
      </div>
    </div>
  `
  root.querySelector('#back').addEventListener('click', () => navigate('settings'))
  root.querySelector('#show-welcome').addEventListener('click', () => {
    localStorage.removeItem(FIRST_RUN_KEY)
    showWelcomeGuide(root)
  })
}

function faq(q, a) {
  return `
    <div class="faq-row" onclick="this.classList.toggle('open')">
      <div class="faq-q">${q} <span class="faq-arrow">›</span></div>
      <div class="faq-a">${a}</div>
    </div>
  `
}
