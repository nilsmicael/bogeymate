// ─────────────────────────────────────────────
//  lib/courses.js
//  Database functions for course GPS data.
//  Add this SQL to Supabase before using:
//  (included in supabase-schema-gps.sql)
// ─────────────────────────────────────────────

import { supabase } from './supabase.js'

// ─── Courses ─────────────────────────────────

export async function searchCourses(query) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, location, holes_count, osm_fetched')
    .ilike('name', `%${query}%`)
    .limit(10)
  if (error) throw error
  return data
}

export async function getCourse(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select(`*, course_holes(*)`)
    .eq('id', courseId)
    .single()
  if (error) throw error
  return data
}

export async function createCourse({ name, location, holesCount, createdBy }) {
  const { data, error } = await supabase
    .from('courses')
    .insert({ name, location, holes_count: holesCount, created_by: createdBy, osm_fetched: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markOsmFetched(courseId) {
  await supabase.from('courses').update({ osm_fetched: true }).eq('id', courseId)
}

// ─── Course holes (GPS points) ────────────────

export async function getCourseHoles(courseId) {
  const { data, error } = await supabase
    .from('course_holes')
    .select('*')
    .eq('course_id', courseId)
    .order('hole_number')
  if (error) throw error
  return data
}

export async function upsertHolePoint(courseId, holeNumber, pointType, lat, lon, source = 'manual') {
  // pointType: 'green_center' | 'green_front' | 'green_back' | 'tee' | 'hazard'
  const { data: existing } = await supabase
    .from('course_holes')
    .select('id')
    .eq('course_id', courseId)
    .eq('hole_number', holeNumber)
    .single()

  if (existing) {
    const updateField = {
      green_center: { green_lat: lat, green_lon: lon },
      green_front:  { front_lat:  lat, front_lon:  lon },
      green_back:   { back_lat:   lat, back_lon:   lon },
      tee:          { tee_lat:    lat, tee_lon:    lon }
    }[pointType] || {}
    updateField.source = source
    updateField.updated_at = new Date().toISOString()
    await supabase.from('course_holes').update(updateField).eq('id', existing.id)
  } else {
    const insert = {
      course_id: courseId,
      hole_number: holeNumber,
      source
    }
    if (pointType === 'green_center') { insert.green_lat = lat; insert.green_lon = lon }
    if (pointType === 'green_front')  { insert.front_lat  = lat; insert.front_lon  = lon }
    if (pointType === 'green_back')   { insert.back_lat   = lat; insert.back_lon   = lon }
    if (pointType === 'tee')          { insert.tee_lat    = lat; insert.tee_lon    = lon }
    await supabase.from('course_holes').insert(insert)
  }
}

export async function importOsmHoles(courseId, osmGreens) {
  for (const g of osmGreens) {
    if (!g.holeNumber || !g.lat || !g.lon) continue
    await upsertHolePoint(courseId, g.holeNumber, 'green_center', g.lat, g.lon, 'osm')
  }
  await markOsmFetched(courseId)
}

// ─── Hazards (bunkrar och vattenhinder) ───────

export async function getHazards(courseId, holeNumber) {
  const { data, error } = await supabase
    .from('course_hazards')
    .select('*')
    .eq('course_id', courseId)
    .eq('hole_number', holeNumber)
    .order('hazard_type')
  if (error) throw error
  return data
}

export async function addHazard(courseId, holeNumber, hazardType, lat, lon, label, userId) {
  const { error } = await supabase
    .from('course_hazards')
    .insert({
      course_id:   courseId,
      hole_number: holeNumber,
      hazard_type: hazardType,
      lat, lon,
      label:       label || null,
      created_by:  userId
    })
  if (error) throw error
}

export async function deleteHazard(hazardId) {
  const { error } = await supabase
    .from('course_hazards')
    .delete()
    .eq('id', hazardId)
  if (error) throw error
}
