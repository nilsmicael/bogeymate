// ─────────────────────────────────────────────
//  lib/supabase.js
//  All database communication goes through here.
//  Replace the two constants below with your own
//  values from the Supabase dashboard.
// ─────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// !! STEG 3: Byt ut dessa två rader med dina egna värden från Supabase !!
export const SUPABASE_URL = 'https://guatphrwwwmwgiavdqed.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1YXRwaHJ3d3dtd2dpYXZkcWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODE1MzQsImV4cCI6MjA5MDY1NzUzNH0.ph4x6XfAUVcyCiHBx4Eo7XWL1jOMl4lQCVSc7CY1zH0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── AUTH ────────────────────────────────────

export async function signUp(email, password, fullName, handicap) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, handicap } }
  })
  if (error) throw error
  // Create profile row
  await supabase.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    handicap: parseFloat(handicap),
    notify_new_round: true,
    notify_scores: true,
    notify_finished: false,
    notify_invites: true,
    public_rounds: true,
    public_profile: true
  })
  return data.user
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
}

// ─── ROUNDS ──────────────────────────────────

export async function createRound({
  courseName, holes, format, startHole, shotgunHole, hostId
}) {
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      course_name: courseName,
      holes: parseInt(holes),
      format,
      start_hole: shotgunHole || startHole,
      is_shotgun: !!shotgunHole,
      host_id: hostId,
      status: 'active'
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addPlayerToRound(roundId, userId, handicap) {
  const { error } = await supabase
    .from('round_players')
    .insert({ round_id: roundId, user_id: userId, handicap })
  if (error) throw error
}

export async function getActiveRounds() {
  const { data, error } = await supabase
    .from('rounds')
    .select(`
      *,
      round_players (
        user_id,
        handicap,
        profiles ( full_name )
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getRound(roundId) {
  const { data, error } = await supabase
    .from('rounds')
    .select(`
      *,
      round_players (
        user_id,
        handicap,
        profiles ( full_name )
      )
    `)
    .eq('id', roundId)
    .single()
  if (error) throw error
  return data
}

export async function finishRound(roundId) {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', roundId)
  if (error) throw error
}

export async function getFinishedRounds(userId) {
  const { data, error } = await supabase
    .from('rounds')
    .select(`
      *,
      round_players!inner ( user_id ),
      scores ( stableford_points, strokes )
    `)
    .eq('round_players.user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

// ─── SCORES ──────────────────────────────────

export async function upsertScore({
  roundId, userId, holeNumber, strokes, pickedUp,
  par, handicapStrokes
}) {
  const nettoStrokes = pickedUp ? null : strokes - handicapStrokes
  const stablefordPoints = pickedUp ? 0 : Math.max(0, par + handicapStrokes - strokes + 2)
  const vsParBrutto = pickedUp ? null : strokes - par

  const { error } = await supabase
    .from('scores')
    .upsert({
      round_id: roundId,
      user_id: userId,
      hole_number: holeNumber,
      strokes: pickedUp ? null : strokes,
      picked_up: pickedUp,
      par,
      handicap_strokes: handicapStrokes,
      netto_strokes: nettoStrokes,
      stableford_points: stablefordPoints,
      vs_par_brutto: vsParBrutto,
      updated_at: new Date().toISOString()
    }, { onConflict: 'round_id,user_id,hole_number' })
  if (error) throw error
}

export async function getScores(roundId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId)
    .order('hole_number')
  if (error) throw error
  return data
}

export async function getLeaderboard(roundId) {
  const { data, error } = await supabase
    .from('scores')
    .select(`
      user_id,
      hole_number,
      stableford_points,
      strokes,
      vs_par_brutto,
      picked_up,
      updated_at,
      profiles ( full_name )
    `)
    .eq('round_id', roundId)
  if (error) throw error
  return data
}

// ─── REACTIONS ───────────────────────────────

export async function addReaction(roundId, holeNumber, userId, emoji) {
  const { error } = await supabase
    .from('reactions')
    .upsert(
      { round_id: roundId, hole_number: holeNumber, user_id: userId, emoji },
      { onConflict: 'round_id,hole_number,user_id,emoji' }
    )
  if (error) throw error
}

export async function getReactions(roundId) {
  const { data, error } = await supabase
    .from('reactions')
    .select('hole_number, emoji')
    .eq('round_id', roundId)
  if (error) throw error
  return data
}

// ─── REALTIME SUBSCRIPTIONS ──────────────────

export function subscribeToRound(roundId, onScore, onReaction) {
  const channel = supabase
    .channel(`round-${roundId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'scores',
      filter: `round_id=eq.${roundId}`
    }, onScore)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'reactions',
      filter: `round_id=eq.${roundId}`
    }, onReaction)
    .subscribe()
  return channel
}

export function unsubscribe(channel) {
  supabase.removeChannel(channel)
}

// ─── INVITES ─────────────────────────────────

export async function createInvite(roundId, invitedBy) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data, error } = await supabase
    .from('invites')
    .insert({ round_id: roundId, invited_by: invitedBy, code, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function joinByCode(code, userId) {
  const { data: invite, error } = await supabase
    .from('invites')
    .select('*')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (error) throw new Error('Ogiltig eller utgången inbjudningskod')
  const profile = await getProfile(userId)
  await addPlayerToRound(invite.round_id, userId, profile.handicap)
  return invite.round_id
}

// ─── OFFLINE QUEUE ───────────────────────────
// Slag sparas lokalt om nätet är borta och
// laddas upp automatiskt när uppkopplingen återkommer.

const QUEUE_KEY = 'bogeymate_offline_queue'

export function queueScore(scoreData) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  queue.push({ ...scoreData, _queued: Date.now() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function flushQueue() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  if (!queue.length) return 0
  const remaining = []
  for (const item of queue) {
    try {
      await upsertScore(item)
    } catch {
      remaining.push(item)
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return queue.length - remaining.length
}

export function getQueueLength() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length
}
