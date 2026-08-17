export interface ExtractedRow {
  code: string
  l: number | null
  w: number | null
  thicknessMm: number | null
  cell: number | null
  sheetQty: number
}

export interface PriceGridEntry {
  thicknessMm: number
  cell: number
  pricePerM2: number
}

export interface RatedRow extends ExtractedRow {
  rate: number | null
  flagged: boolean
  flagReason: string | null
}
