export interface HCExtraction {
  id: string
  created_by: string | null
  created_at: string
  source_type: 'excel' | 'paste'
  row_count: number
  total_rate: number
  status: 'saved' | 'edited'
}

export interface HCExtractionRow {
  id: string
  extraction_id: string
  code: string | null
  l: number | null
  w: number | null
  thickness_mm: number | null
  cell: number | null
  sheet_qty: number
  rate: number | null
  flagged: boolean
  flag_reason: string | null
}

export interface HCExtractionRowHistory {
  id: string
  row_id: string
  edited_by: string | null
  edited_at: string
  field_changed: string
  old_value: string | null
  new_value: string | null
}

export interface PriceGridRow {
  thickness_mm: number
  cell: number
  price_per_m2: number
  updated_by: string | null
  updated_at: string
}
