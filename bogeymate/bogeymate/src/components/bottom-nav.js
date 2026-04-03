// components/bottom-nav.js
export function renderBottomNav(active) {
  const items = [
    { id: 'home',     icon: '🏠', label: 'Hem' },
    { id: 'newround', icon: '➕', label: 'Ny runda' },
    { id: 'stats',    icon: '📊', label: 'Statistik' },
    { id: 'settings', icon: '⚙️', label: 'Inställningar' }
  ]
  return `
    <nav class="bottom-nav" id="bottom-nav">
      ${items.map(item => `
        <button class="bn-btn ${active===item.id?'active':''}" data-nav="${item.id}" type="button">
          <span class="bn-icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `
}

export function wireBottomNav() {
  const nav = document.getElementById('bottom-nav')
  if (!nav) return
  // Remove old listener by cloning
  const fresh = nav.cloneNode(true)
  nav.parentNode.replaceChild(fresh, nav)
  fresh.addEventListener('click', e => {
    const btn = e.target.closest('[data-nav]')
    if (!btn) return
    import('../main.js').then(({ navigate, state, showToast }) => {
      const page = btn.dataset.nav
      if ((page === 'newround' || page === 'stats') && state.isGuest) {
        showToast('Logga in för att använda den här funktionen', 'info')
        return
      }
      navigate(page)
    })
  })
}
