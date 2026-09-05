import { supabase } from '../supabase'
import type { NewWoodMeasurement, WoodMeasurement } from './dbTypes'

const yaamya = () => supabase.schema('yaamya')

export async function fetchWoodMeasurements(): Promise<WoodMeasurement[]> {
  const { data, error } = await yaamya()
    .from('wood_measurements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WoodMeasurement[]
}

export async function insertWoodMeasurement(payload: NewWoodMeasurement): Promise<void> {
  const { error } = await yaamya().from('wood_measurements').insert([payload])
  if (error) throw error
}

// Local-time helpers — entries are logged in the yard's wall-clock time, not
// UTC, so both date and time are computed client-side (matches the old app).
export function getTodayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getNowLocalTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// Length is in feet, width/height in inches — the standard timber CFT formula
// for that mix is (L_ft x W_in x H_in) / 144, NOT /1728 (which is only right
// when all three are inches). Using /1728 here would under-report 12x.
export function computeCft(lengthFt: number, widthIn: number, heightIn: number, pieces: number): number {
  return (lengthFt * widthIn * heightIn * pieces) / 144
}
