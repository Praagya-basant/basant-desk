import type { ExtractedRow, PriceGridEntry, RatedRow } from './types'

const INCH = 0.0254

export function priceGridKey(thicknessMm: number, cell: number): string {
  return `${thicknessMm}_${cell}`
}

export function buildPriceGridLookup(grid: PriceGridEntry[]): Map<string, number> {
  const lookup = new Map<string, number>()
  for (const entry of grid) {
    lookup.set(priceGridKey(entry.thicknessMm, entry.cell), entry.pricePerM2)
  }
  return lookup
}

export function rateRow(row: ExtractedRow, gridLookup: Map<string, number>): RatedRow {
  if (row.l == null || row.w == null || row.thicknessMm == null || row.cell == null) {
    return { ...row, rate: null, flagged: true, flagReason: 'Could not parse dimension, thickness, or cell' }
  }

  const price = gridLookup.get(priceGridKey(row.thicknessMm, row.cell))
  if (price == null) {
    return { ...row, rate: null, flagged: true, flagReason: 'No price grid match' }
  }

  const rate = Math.round(row.l * INCH * (row.w * INCH) * price * row.sheetQty * 100) / 100
  return { ...row, rate, flagged: false, flagReason: null }
}

export function rateRows(rows: ExtractedRow[], grid: PriceGridEntry[]): RatedRow[] {
  const lookup = buildPriceGridLookup(grid)
  return rows.map((row) => rateRow(row, lookup))
}
