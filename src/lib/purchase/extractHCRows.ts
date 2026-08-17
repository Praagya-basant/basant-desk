import type { ExtractedRow } from './types'

const CODE_RE = /^([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)*)/
const DIMENSION_RE = /(\d+(?:\.\d+)?)\s*[*xX\t]\s*(\d+(?:\.\d+)?)/g
const QTY_RE = /^\s*\(\s*(\d+)\s*\)/
const THICKNESS_RE = /(\d+(?:\.\d+)?)\s*MM\b/i
const CELL_RE = /(\d+)\s*CELL\b/i

function cleanBody(raw: string): string {
  return raw
    .replace(/"/g, '')
    .replace(/\bINCH\b/gi, '')
    .replace(/die\s*cut\s*as\s*per\s*photo/gi, '')
}

function extractLine(line: string): ExtractedRow[] {
  const trimmed = line.trim()
  if (!trimmed) return []

  const codeMatch = trimmed.match(CODE_RE)
  const code = codeMatch ? codeMatch[1] : ''
  // Anything between the code and the first dimension (e.g. "(leg)", "(1)")
  // is a marker, not data — it's simply never matched by the regexes below.
  const rest = cleanBody(trimmed.slice(codeMatch ? codeMatch[0].length : 0))

  const dimensions: { start: number; end: number; l: number; w: number }[] = []
  DIMENSION_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DIMENSION_RE.exec(rest)) !== null) {
    dimensions.push({ start: m.index, end: m.index + m[0].length, l: Number(m[1]), w: Number(m[2]) })
  }

  if (dimensions.length === 0) {
    return [{ code, l: null, w: null, thicknessMm: null, cell: null, sheetQty: 1 }]
  }

  const rows: ExtractedRow[] = []

  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i]

    // A sheet-qty override must sit immediately after the dimension.
    const afterDim = rest.slice(dim.end)
    const qtyMatch = afterDim.match(QTY_RE)
    const sheetQty = qtyMatch ? Number(qtyMatch[1]) : 1
    const qtyEnd = dim.end + (qtyMatch ? qtyMatch[0].length : 0)

    // Thickness/cell for this block live in the text between this block's
    // own tokens and the start of the next dimension — never further, so a
    // block's descriptor can't bleed into its neighbor's.
    const nextStart = i + 1 < dimensions.length ? dimensions[i + 1].start : rest.length
    const trailingWindow = rest.slice(qtyEnd, nextStart)

    let thicknessMatch = trailingWindow.match(THICKNESS_RE)
    let cellMatch = trailingWindow.match(CELL_RE)

    // Only the first block can have its descriptor written before the
    // dimension (e.g. "30MM 6 CELL 24X18") since there's no prior block to
    // own that leading text.
    if (i === 0 && (!thicknessMatch || !cellMatch)) {
      const leadingWindow = rest.slice(0, dim.start)
      if (!thicknessMatch) thicknessMatch = leadingWindow.match(THICKNESS_RE)
      if (!cellMatch) cellMatch = leadingWindow.match(CELL_RE)
    }

    rows.push({
      code,
      l: dim.l,
      w: dim.w,
      thicknessMm: thicknessMatch ? Number(thicknessMatch[1]) : null,
      cell: cellMatch ? Number(cellMatch[1]) : null,
      sheetQty,
    })
  }

  return rows
}

export function extractHCRows(input: string[]): ExtractedRow[] {
  const all = input.flatMap(extractLine)

  const seen = new Set<string>()
  const deduped: ExtractedRow[] = []
  for (const row of all) {
    const key = JSON.stringify([row.code, row.l, row.w, row.thicknessMm, row.cell, row.sheetQty])
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(row)
    }
  }

  return deduped
}
