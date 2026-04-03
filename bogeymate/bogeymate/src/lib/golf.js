// ─────────────────────────────────────────────
//  lib/golf.js
//  All golf-specific calculations live here.
// ─────────────────────────────────────────────

// Standard par and stroke index for 18 holes.
// These are generic values — in the real app the
// course data should come from the database.
export const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4, 4,3,5,4,4,5,3,4,4]
export const DEFAULT_SI   = [7,15,3,11,9,17,1,13,5, 6,16,2,12,8,4,18,10,14]

/**
 * How many handicap strokes does a player receive on a hole?
 * @param {number} playerHcp  - Playing handicap (whole number)
 * @param {number} si         - Stroke index of the hole (1–18)
 * @returns {number} 0, 1, or 2
 */
export function handicapStrokes(playerHcp, si) {
  if (playerHcp >= si + 18) return 2
  if (playerHcp >= si) return 1
  return 0
}

/**
 * Playing handicap = handicap index × slope / 113 + (course rating − par)
 * For simplicity we use exact handicap index when slope/rating are unknown.
 */
export function playingHandicap(hcpIndex, slope = 113, courseRating = null, par = 72) {
  if (courseRating) {
    return Math.round(hcpIndex * (slope / 113) + (courseRating - par))
  }
  return Math.round(hcpIndex)
}

/**
 * Stableford points for a hole.
 * @param {number} strokes         - Gross strokes
 * @param {number} par             - Hole par
 * @param {number} hcpStrokes      - Handicap strokes received on this hole
 * @returns {number}
 */
export function stablefordPoints(strokes, par, hcpStrokes) {
  return Math.max(0, par + hcpStrokes - strokes + 2)
}

/**
 * Net double bogey — the maximum score to register on a hole in Stableford.
 * Anything above this = pick up.
 */
export function maxStrokes(par, hcpStrokes) {
  return par + hcpStrokes + 2
}

/**
 * Format strokes-vs-par as a string: "Eagle", "Birdie", "Par", "+1" etc.
 */
export function vsParLabel(diff) {
  if (diff <= -3) return 'Albatross'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0)  return 'Par'
  if (diff === 1)  return 'Bogey'
  if (diff === 2)  return 'Dubbel-bogey'
  return `+${diff}`
}

/**
 * Calculates the handicap-registration value for a partial round.
 * Rules per SGF / World Handicap System:
 *   18 hål → no addition
 *   13–17  → system calculates proportionally
 *   12 hål → add 11 points  (6 holes × 2 − 1)
 *    9 hål → separate 9-hole round, no addition here
 *   < 9    → not registerable
 *
 * @param {number} stablefordGross  - Gross Stableford points scored
 * @param {number} holesPlayed      - Number of holes actually played
 * @returns {{ registrationPoints: number, addition: number, note: string, registerable: boolean }}
 */
export function handicapRegistration(stablefordGross, holesPlayed) {
  if (holesPlayed < 9) {
    return { registrationPoints: null, addition: 0, note: 'Färre än 9 hål kan inte registreras', registerable: false }
  }
  if (holesPlayed === 9) {
    return { registrationPoints: stablefordGross, addition: 0, note: '9-hålsrond — registreras separat på MinGolf', registerable: true }
  }
  if (holesPlayed === 12) {
    const addition = 11
    return { registrationPoints: stablefordGross + addition, addition, note: '6 hål × 2p − 1 = 11p tillägg (systemregel)', registerable: true }
  }
  if (holesPlayed >= 13 && holesPlayed <= 17) {
    const missingHoles = 18 - holesPlayed
    const addition = Math.round(missingHoles * 2 - 1)
    return { registrationPoints: stablefordGross + addition, addition, note: `${missingHoles} hål saknas — proportionellt tillägg`, registerable: true }
  }
  // 18 holes
  return { registrationPoints: stablefordGross, addition: 0, note: 'Full 18-hålsrond, inga tillägg', registerable: true }
}

/**
 * Build leaderboard from an array of score rows.
 * Returns players sorted by total Stableford descending.
 */
export function buildLeaderboard(scores, players) {
  const byPlayer = {}

  for (const player of players) {
    byPlayer[player.user_id] = {
      userId: player.user_id,
      name: player.profiles?.full_name || 'Okänd',
      totalStableford: 0,
      totalStrokes: 0,
      totalVsPar: 0,
      holesPlayed: 0,
      lastHole: 0,
      lastUpdated: null,
      scores: {}
    }
  }

  for (const score of scores) {
    const p = byPlayer[score.user_id]
    if (!p) continue
    p.scores[score.hole_number] = score
    if (!score.picked_up) {
      p.totalStableford += score.stableford_points || 0
      p.totalStrokes    += score.strokes || 0
      p.totalVsPar      += score.vs_par_brutto || 0
    }
    p.holesPlayed++
    if (score.hole_number > p.lastHole) p.lastHole = score.hole_number
    if (!p.lastUpdated || score.updated_at > p.lastUpdated) p.lastUpdated = score.updated_at
  }

  return Object.values(byPlayer).sort((a, b) => b.totalStableford - a.totalStableford)
}

/**
 * Returns a CSS class name and label for the activity indicator.
 * @param {string|null} lastUpdated - ISO timestamp
 */
export function activityStatus(lastUpdated) {
  if (!lastUpdated) return { cls: 'act-inactive', label: 'Ingen aktivitet' }
  const minAgo = Math.floor((Date.now() - new Date(lastUpdated)) / 60000)
  if (minAgo < 8)  return { cls: 'act-recent',   label: `${minAgo} min sedan` }
  if (minAgo < 35) return { cls: 'act-stale',    label: `${minAgo} min sedan` }
  return               { cls: 'act-inactive',  label: `${minAgo} min sedan` }
}

/**
 * Build round summary statistics for the end-of-round screen.
 */
export function roundSummary(scores, pars, hcpStrokes) {
  let birdies = 0, eagles = 0, pars_ = 0, bogeys = 0, doubles = 0
  let totalStrokes = 0, totalNetto = 0, totalStableford = 0

  for (const score of scores) {
    if (score.picked_up) continue
    const diff = score.vs_par_brutto
    if (diff <= -2) eagles++
    else if (diff === -1) birdies++
    else if (diff === 0) pars_++
    else if (diff === 1) bogeys++
    else doubles++
    totalStrokes    += score.strokes || 0
    totalNetto      += score.netto_strokes || 0
    totalStableford += score.stableford_points || 0
  }

  const bestHoles = [...scores]
    .filter(s => !s.picked_up)
    .sort((a, b) => (b.stableford_points || 0) - (a.stableford_points || 0))
    .slice(0, 3)

  return { birdies, eagles, pars: pars_, bogeys, doubles, totalStrokes, totalNetto, totalStableford, bestHoles }
}

export const FORMAT_DESCRIPTIONS = {
  'slagspel':   { label: 'Slagspel',  desc: 'Räknar totala slag. Lägst antal vinner.' },
  'stableford': { label: 'Stableford', desc: 'Poäng per hål. Mest poäng vinner.' },
  'matchspel':  { label: 'Matchspel', desc: 'Hål mot hål. Bäst på flest hål vinner.' },
  'fourball':   { label: 'Four-ball', desc: 'Par mot par. Bästa bollen per hål räknas.' },
  'foursome':   { label: 'Foursome',  desc: 'Par spelar växelvis med en boll.' },
  'scramble':   { label: 'Scramble',  desc: 'Laget väljer bästa bollen varje slag.' },
  'bestball':   { label: 'Best ball', desc: 'Lagets bästa individuella score per hål.' }
}
