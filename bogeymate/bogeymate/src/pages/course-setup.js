// ─────────────────────────────────────────────
//  pages/course-setup.js
//  Add a new course, fetch OSM data automatically,
//  and manage which holes have GPS points.
// ─────────────────────────────────────────────

import { navigate, state, showToast } from '../main.js'
import { findCourseInOSM, fetchGreensFromOSM, boundingBox } from '../lib/gps.js'
import { searchCourses, createCourse, getCourse, getCourseHoles, importOsmHoles } from '../lib/courses.js'

export function renderCourseSetup(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="back-btn" id="back">← Tillbaka</button>
        <h1 class="page-title">Banor & GPS</h1>
        <div style="width:60px;"></div>
      </div>

      <!-- Search existing courses -->
      <div class="section-header" style="margin-top:0;">Sök bland sparade banor</div>
      <div style="padding: 0 16px; margin-bottom: 12px;">
        <div style="display:flex; gap:8px;">
          <input type="text" id="search-input" placeholder="T.ex. Sunne GK" style="flex:1;" />
          <button class="btn-small-green" id="search-btn">Sök</button>
        </div>
      </div>
      <div id="search-results"></div>

      <!-- Add new course -->
      <div class="section-header">Lägg till ny bana</div>
      <div class="card">
        <div class="input-row">
          <label>Banans namn</label>
          <input type="text" id="new-name" placeholder="T.ex. Sunne GK" />
        </div>
        <div class="input-row">
          <label>Ort / region (hjälper OSM-sökning)</label>
          <input type="text" id="new-location" placeholder="T.ex. Sunne, Värmland" />
        </div>
        <div class="input-row" style="margin-bottom:0;">
          <label>Antal hål</label>
          <select id="new-holes">
            <option value="18">18 hål</option>
            <option value="9">9 hål</option>
          </select>
        </div>
      </div>

      <button class="btn-primary" id="add-course-btn">Lägg till bana och hämta OSM-data</button>

      <!-- Status panel -->
      <div id="osm-status" style="display:none;">
        <div class="card info-box-green" id="osm-status-msg"></div>
      </div>

      <!-- Course detail / hole list -->
      <div id="course-detail" style="display:none;">
        <div class="section-header" id="course-detail-title">GPS-punkter per hål</div>
        <div class="card card-list" id="hole-list"></div>
        <div style="padding: 0 16px; font-size:12px; color:var(--color-muted); margin-top:6px; line-height:1.5;">
          Hål utan grön markering saknar GPS-data. Gå till banan och markera dem via GPS-skärmen under en runda.
        </div>
      </div>
    </div>
  `

  root.querySelector('#back').addEventListener('click', () => navigate('settings'))

  // ─── Search ────────────────────────────────
  root.querySelector('#search-btn').addEventListener('click', async () => {
    const q = root.querySelector('#search-input').value.trim()
    if (!q) return
    try {
      const results = await searchCourses(q)
      const el = root.querySelector('#search-results')
      if (!results.length) {
        el.innerHTML = `<div class="empty-state">Inga sparade banor hittades. Lägg till banan nedan.</div>`
        return
      }
      el.innerHTML = `<div class="card card-list">${results.map(c => `
        <div class="list-row" data-cid="${c.id}" style="cursor:pointer;">
          <div style="flex:1;">
            <div class="row-title">${c.name}</div>
            <div class="row-sub">${c.location || ''} · ${c.holes_count} hål · ${c.osm_fetched ? '✓ OSM-data hämtad' : 'Ingen OSM-data'}</div>
          </div>
          <span class="pill ${c.osm_fetched ? 'pill-green' : 'pill-gray'}">${c.osm_fetched ? 'Klar' : 'Ofullständig'}</span>
        </div>
      `).join('')}</div>`

      el.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', () => loadCourseDetail(row.dataset.cid))
      })
    } catch (e) {
      showToast('Sökning misslyckades: ' + e.message, 'error')
    }
  })

  // ─── Add course + OSM fetch ────────────────
  root.querySelector('#add-course-btn').addEventListener('click', async () => {
    const name     = root.querySelector('#new-name').value.trim()
    const location = root.querySelector('#new-location').value.trim()
    const holes    = parseInt(root.querySelector('#new-holes').value)
    if (!name) return showToast('Ange ett bannamn', 'error')

    const btn = root.querySelector('#add-course-btn')
    btn.textContent = 'Skapar bana…'; btn.disabled = true

    const statusEl  = root.querySelector('#osm-status')
    const statusMsg = root.querySelector('#osm-status-msg')
    statusEl.style.display = 'block'

    try {
      // 1. Create course in DB
      statusMsg.textContent = '1/3 — Skapar bana i databasen…'
      const course = await createCourse({ name, location, holesCount: holes, createdBy: state.user?.id })

      // 2. Search OSM
      statusMsg.textContent = '2/3 — Söker i OpenStreetMap…'
      let osmGreens = []
      try {
        const searchTerm = name.replace(/\s*GK\s*$/i, '').replace(/\s*Golfklubb\s*$/i, '').trim()
        const elements   = await findCourseInOSM(searchTerm)
        if (elements.length > 0) {
          const bbox = boundingBox(elements)
          statusMsg.textContent = '3/3 — Hämtar green-koordinater…'
          osmGreens = await fetchGreensFromOSM(bbox.south, bbox.west, bbox.north, bbox.east)
        }
      } catch {
        // OSM failed — not critical, user can mark manually
      }

      // 3. Import greens
      if (osmGreens.length > 0) {
        await importOsmHoles(course.id, osmGreens)
        const counted = osmGreens.filter(g => g.holeNumber).length
        statusMsg.innerHTML = `✓ Bana skapad! Hittade <strong>${counted} hål</strong> i OpenStreetMap och importerade dem automatiskt.
          <br>Kontrollera hålen nedan och fyll i eventuella som saknas manuellt.`
      } else {
        statusMsg.innerHTML = `✓ Bana skapad! OpenStreetMap hade ingen detaljdata för ${name}.
          <br>Gå ut på banan och markera greenerna via GPS-skärmen under en runda.`
      }

      // Show hole list
      await loadCourseDetail(course.id)
      showToast(name + ' sparad!', 'success')

    } catch (e) {
      statusMsg.innerHTML = `⚠️ Fel: ${e.message}`
      showToast('Något gick fel', 'error')
    }

    btn.textContent = 'Lägg till bana och hämta OSM-data'
    btn.disabled = false
  })

  // ─── Course detail / hole status ──────────
  async function loadCourseDetail(courseId) {
    const detail    = root.querySelector('#course-detail')
    const holeList  = root.querySelector('#hole-list')
    const titleEl   = root.querySelector('#course-detail-title')
    detail.style.display = 'block'

    try {
      const [course, holes] = await Promise.all([
        getCourse(courseId),
        getCourseHoles(courseId)
      ])
      titleEl.textContent = `GPS-punkter — ${course.name}`

      const holeNumbers = Array.from({ length: course.holes_count }, (_, i) => i + 1)
      holeList.innerHTML = holeNumbers.map(n => {
        const h = holes.find(x => x.hole_number === n)
        const hasCenter = !!(h?.green_lat)
        const hasFront  = !!(h?.front_lat)
        const hasBack   = !!(h?.back_lat)
        const source    = h?.source === 'osm' ? 'OSM' : h ? 'Manuell' : ''
        return `
          <div class="list-row">
            <div style="font-size:15px; font-weight:500; color:var(--color-text); width:28px;">
              ${n}
            </div>
            <div style="flex:1;">
              <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:2px;">
                <span class="pill ${hasCenter ? 'pill-green' : 'pill-gray'}" style="font-size:10px; padding:2px 7px;">Mitten</span>
                <span class="pill ${hasFront  ? 'pill-green' : 'pill-gray'}" style="font-size:10px; padding:2px 7px;">Front</span>
                <span class="pill ${hasBack   ? 'pill-green' : 'pill-gray'}" style="font-size:10px; padding:2px 7px;">Bak</span>
              </div>
            </div>
            <div style="font-size:11px; color:var(--color-muted);">${source}</div>
          </div>
        `
      }).join('')
    } catch (e) {
      holeList.innerHTML = `<div class="empty-state">Kunde inte ladda håldata.</div>`
    }
  }
}
