// components/bottom-nav.js
export function renderBottomNav(active) {
  const items = [
    { id: 'home',     icon: '🏠', label: 'Hem' },
    { id: 'newround', icon: '+',  label: 'Ny runda' },
    { id: 'settings', icon: '⚙', label: 'Inställningar' }
  ]
  return `
    <nav class="bottom-nav">
      ${items.map(item => `
        <button class="bn-btn ${active === item.id ? 'active' : ''}" data-page="${item.id}">
          <span class="bn-icon">${item.icon}</span>
          ${item.label}
        </button>
      `).join('')}
    </nav>
  `
}

// Wire up bottom nav after rendering
export function attachBottomNav(root) {
  root.querySelectorAll('.bn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      import('../main.js').then(({ navigate }) => navigate(btn.dataset.page))
    })
  })
}
