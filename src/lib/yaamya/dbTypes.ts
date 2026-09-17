// Mirrors yaamya.wood_measurements — column shape kept identical to the
// standalone Yaamya Industries app this module was ported from.
export interface WoodMeasurement {
  id: number
  created_at: string
  entry_date: string
  entry_time: string
  location: string
  wood_type: string
  wood_condition: string
  source: string | null
  supplier_name: string | null
  batch_code: string | null
  bill_no: string | null
  checker_name: string | null
  height_inches: number | null
  length_ft: number
  width_inches: number
  pieces: number
  total_cft: number
  quality: 'Good' | 'Bad'
  user_id: string | null
}

export type NewWoodMeasurement = Omit<WoodMeasurement, 'id' | 'created_at'>

export const LOCATIONS = ['Bhandu', 'Boranada'] as const
export const WOOD_TYPES = ['Acacia', 'Mango', 'Sheesham', 'Oak', 'Teak', 'Pine', 'Walnut'] as const
export const WOOD_CONDITIONS = ['Seasoned', 'Unseasoned'] as const
export const SEASONED_SOURCES = ['Outsourced', 'Basant Chambers'] as const
export const QUALITIES = ['Good', 'Bad'] as const
