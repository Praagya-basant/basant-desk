import { supabase } from '../supabase'
import type { RatedRow } from './types'
import type { HCExtraction, HCExtractionRow, HCExtractionRowHistory, PriceGridRow } from './dbTypes'

const purchase = () => supabase.schema('purchase')

export async function fetchPriceGrid(): Promise<PriceGridRow[]> {
  const { data, error } = await purchase().from('hc_price_grid').select('*').order('thickness_mm').order('cell')
  if (error) throw error
  return data as PriceGridRow[]
}

export async function upsertPriceGridEntry(thicknessMm: number, cell: number, pricePerM2: number, updatedBy: string) {
  const { error } = await purchase()
    .from('hc_price_grid')
    .update({ price_per_m2: pricePerM2, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('thickness_mm', thicknessMm)
    .eq('cell', cell)
  if (error) throw error
}

export async function saveExtraction(params: {
  createdBy: string
  sourceType: 'excel' | 'paste'
  rows: RatedRow[]
}): Promise<string> {
  const totalRate = params.rows.reduce((sum, r) => sum + (r.rate ?? 0), 0)

  const { data: extraction, error: extractionError } = await purchase()
    .from('hc_extractions')
    .insert({
      created_by: params.createdBy,
      source_type: params.sourceType,
      row_count: params.rows.length,
      total_rate: Math.round(totalRate * 100) / 100,
      status: 'saved',
    })
    .select('id')
    .single()

  if (extractionError) throw extractionError

  const extractionId = (extraction as { id: string }).id

  const { error: rowsError } = await purchase()
    .from('hc_extraction_rows')
    .insert(
      params.rows.map((row) => ({
        extraction_id: extractionId,
        code: row.code,
        l: row.l,
        w: row.w,
        thickness_mm: row.thicknessMm,
        cell: row.cell,
        sheet_qty: row.sheetQty,
        rate: row.rate,
        flagged: row.flagged,
        flag_reason: row.flagReason,
      })),
    )

  if (rowsError) throw rowsError

  return extractionId
}

export async function fetchExtractions(): Promise<HCExtraction[]> {
  const { data, error } = await purchase().from('hc_extractions').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as HCExtraction[]
}

export async function fetchExtraction(id: string): Promise<HCExtraction> {
  const { data, error } = await purchase().from('hc_extractions').select('*').eq('id', id).single()
  if (error) throw error
  return data as HCExtraction
}

export async function fetchExtractionRows(extractionId: string): Promise<HCExtractionRow[]> {
  const { data, error } = await purchase()
    .from('hc_extraction_rows')
    .select('*')
    .eq('extraction_id', extractionId)
    .order('code')
  if (error) throw error
  return data as HCExtractionRow[]
}

export async function fetchRowHistory(extractionId: string): Promise<HCExtractionRowHistory[]> {
  const rows = await fetchExtractionRows(extractionId)
  const rowIds = rows.map((r) => r.id)
  if (rowIds.length === 0) return []

  const { data, error } = await purchase()
    .from('hc_extraction_row_history')
    .select('*')
    .in('row_id', rowIds)
    .order('edited_at', { ascending: false })
  if (error) throw error
  return data as HCExtractionRowHistory[]
}

const EDITABLE_FIELDS = ['code', 'l', 'w', 'thickness_mm', 'cell', 'sheet_qty', 'rate', 'flagged', 'flag_reason'] as const

export async function updateExtractionRow(
  row: HCExtractionRow,
  changes: Partial<HCExtractionRow>,
  editedBy: string,
): Promise<void> {
  const historyEntries = EDITABLE_FIELDS.filter(
    (field) => field in changes && changes[field] !== row[field],
  ).map((field) => ({
    row_id: row.id,
    edited_by: editedBy,
    field_changed: field,
    old_value: row[field] == null ? null : String(row[field]),
    new_value: changes[field] == null ? null : String(changes[field]),
  }))

  if (historyEntries.length === 0) return

  const { error: updateError } = await purchase().from('hc_extraction_rows').update(changes).eq('id', row.id)
  if (updateError) throw updateError

  const { error: historyError } = await purchase().from('hc_extraction_row_history').insert(historyEntries)
  if (historyError) throw historyError

  const rows = await fetchExtractionRows(row.extraction_id)
  const totalRate = rows.reduce((sum, r) => sum + (r.rate ?? 0), 0)

  const { error: extractionError } = await purchase()
    .from('hc_extractions')
    .update({ status: 'edited', total_rate: Math.round(totalRate * 100) / 100 })
    .eq('id', row.extraction_id)
  if (extractionError) throw extractionError
}

export async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase.from('users').select('id, full_name, email').in('id', uniqueIds)
  if (error) throw error

  const map = new Map<string, string>()
  for (const u of data as { id: string; full_name: string | null; email: string }[]) {
    map.set(u.id, u.full_name || u.email)
  }
  return map
}
