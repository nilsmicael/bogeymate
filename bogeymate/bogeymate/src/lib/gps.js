// ─────────────────────────────────────────────
//  lib/gps.js
//  GPS utilities: distance calculation, position
//  watching, and OpenStreetMap data fetching.
// ─────────────────────────────────────────────

/**
 * Haversine formula — distance in meters between two GPS coordinates.
 */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Convert meters to yards.
 */
export function toYards(meters) {
  return Math.round(meters * 1.09361)
}

/**
 * Convert meters to display string (meters and yards).
 */
export function formatDistance(meters) {
  const m = Math.round(meters)
  const y = toYards(meters)
  return { meters: m, yards: y, label: `${m} m  /  ${y} yd` }
}

/**
 * Watch GPS position with high accuracy.
 * Returns a watchId that can be passed to stopWatching().
 * @param {function} onUpdate - called with { lat, lon, accuracy }
 * @param {function} onError  - called with error message string
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('GPS stöds inte av din webbläsare')
    return null
  }
  return navigator.geolocation.watchPosition(
    pos => onUpdate({
      lat:      pos.coords.latitude,
      lon:      pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy)
    }),
    err => {
      const msgs = {
        1: 'GPS-åtkomst nekad — tillåt plats i webbläsaren',
        2: 'Kunde inte fastställa position',
        3: 'GPS-timeout — försöker igen'
      }
      onError(msgs[err.code] || 'GPS-fel')
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  )
}

export function stopWatching(watchId) {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
}

/**
 * Get a one-shot position.
 */
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('GPS saknas'))
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      err => reject(new Error('GPS-fel: ' + err.message)),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

// ─────────────────────────────────────────────
//  OpenStreetMap / Overpass API
//  Fetches golf green centroids for a named course.
// ─────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/**
 * Search for a golf course by name and return its bounding box.
 */
export async function findCourseInOSM(courseName) {
  const query = `
    [out:json][timeout:25];
    (
      way["leisure"="golf_course"]["name"~"${courseName}",i];
      relation["leisure"="golf_course"]["name"~"${courseName}",i];
    );
    out body;
    >;
    out skel qt;
  `
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  })
  if (!resp.ok) throw new Error('OSM-sökning misslyckades')
  const data = await resp.json()
  return data.elements
}

/**
 * Fetch all golf greens within a bounding box from OSM.
 * Returns an array of { holeNumber, lat, lon } — hole numbers
 * may be missing if not tagged in OSM.
 */
export async function fetchGreensFromOSM(south, west, north, east) {
  const query = `
    [out:json][timeout:25];
    (
      way["golf"="green"](${south},${west},${north},${east});
      node["golf"="green"](${south},${west},${north},${east});
    );
    out body;
    >;
    out skel qt;
  `
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  })
  if (!resp.ok) throw new Error('OSM-hämtning misslyckades')
  const data = await resp.json()

  // Build node lookup
  const nodes = {}
  for (const el of data.elements) {
    if (el.type === 'node') nodes[el.id] = { lat: el.lat, lon: el.lon }
  }

  const greens = []
  for (const el of data.elements) {
    if (el.type === 'way' && el.tags?.golf === 'green') {
      // Centroid = average of all node coords
      const pts = (el.nodes || []).map(id => nodes[id]).filter(Boolean)
      if (!pts.length) continue
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
      const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length
      greens.push({
        holeNumber: parseInt(el.tags?.ref || el.tags?.hole || '0') || null,
        lat, lon,
        source: 'osm'
      })
    } else if (el.type === 'node' && el.tags?.golf === 'green') {
      greens.push({
        holeNumber: parseInt(el.tags?.ref || el.tags?.hole || '0') || null,
        lat: el.lat, lon: el.lon,
        source: 'osm'
      })
    }
  }
  // Sort by hole number if available
  return greens.sort((a, b) => (a.holeNumber || 99) - (b.holeNumber || 99))
}

/**
 * Compute bounding box from a set of OSM elements.
 */
export function boundingBox(elements) {
  let south = 90, north = -90, west = 180, east = -180
  for (const el of elements) {
    if (el.lat !== undefined) {
      south = Math.min(south, el.lat); north = Math.max(north, el.lat)
      west  = Math.min(west,  el.lon); east  = Math.max(east,  el.lon)
    }
  }
  // Add 10% padding
  const dLat = (north - south) * 0.1
  const dLon = (east  - west)  * 0.1
  return { south: south - dLat, north: north + dLat, west: west - dLon, east: east + dLon }
}

/**
 * Try to auto-detect which hole the player is on based on
 * distance to each green centroid. Returns best guess hole number.
 */
export function detectCurrentHole(playerLat, playerLon, courseHoles) {
  if (!courseHoles?.length) return null
  let best = null, bestDist = Infinity
  for (const h of courseHoles) {
    if (!h.greenLat) continue
    const d = distanceMeters(playerLat, playerLon, h.greenLat, h.greenLon)
    if (d < bestDist) { bestDist = d; best = h }
  }
  // Only suggest if reasonably close (within 400 m of a green)
  return bestDist < 400 ? best : null
}
