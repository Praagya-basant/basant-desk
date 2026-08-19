/**
 * HC (Honeycomb) Sheet Extraction — core parsing logic.
 *
 * Reads the "Description" column of an HC purchase-order export and turns
 * each line into one or more structured rows: Code, L, W, Thickness (mm),
 * Cell, Sheet Qty, and a calculated Rate.
 *
 * Tested against the real HC.xlsx sample (73 description rows -> 117 parsed
 * size rows, 3 correctly flagged as having no size info at all).
 *
 * Column note: in the source Excel, "Description" is column K (index 10) —
 * NOT column A ("Order Reference"). getDescriptionsFromSheet() below finds
 * the column by header name, not by fixed index, so this keeps working
 * regardless of where the column actually sits.
 *
 * Price grid: the PRICE_GRID constant below is a fallback default only.
 * The app always passes the live, admin-editable grid from
 * purchase.hc_price_grid (see db.ts's buildPriceGridRecord), already
 * filtered to the selected supplier, into extractHCRows/parseDescription/
 * lookupRate — so the grid shown in the UI and the grid used to calculate
 * rates never drift apart. Supplier selection itself lives one layer up
 * (the caller); this module just consumes whichever grid it's handed.
 *
 * Multi-code fix: a description can contain MORE THAN ONE product code
 * (e.g. two codes pasted as one block, or one messy Excel cell). Every code
 * token is found up front and the text is split into one segment per code
 * BEFORE dimensions are parsed, so a later code's sizes can never bleed
 * into an earlier code's rows (and vice versa).
 */

// ---------------------------------------------------------------------------
// Price grid: price per square metre, keyed by [thickness mm][cell count]
// ---------------------------------------------------------------------------

export type PriceGrid = Record<number, Record<number, number>>

export const PRICE_GRID: PriceGrid = {
  10: { 6: 92, 8: 69, 12: 61 },
  15: { 6: 105, 8: 79, 12: 67 },
  20: { 6: 126, 8: 90, 12: 77 },
  25: { 6: 148, 8: 102, 12: 83 },
  30: { 6: 164, 8: 115, 12: 92 },
  35: { 6: 188, 8: 125, 12: 100 },
  40: { 6: 205, 8: 135, 12: 108 },
  50: { 6: 249, 8: 156, 12: 117 },
  60: { 6: 295, 8: 182, 12: 133 },
}

const INCHES_TO_METRES = 0.0254

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HCRow {
  code: string
  l: number
  w: number
  thicknessMm: number | null
  cell: number | null
  sheetQty: number
  /** null when thickness/cell weren't found on the price grid, or missing */
  rate: number | null
  /** true when no cell count was found in the description and it was defaulted to 12 — not an error, just an assumption worth surfacing */
  defaultedCell: boolean
  /** the full original description this row was split from */
  sourceDescription: string
}

export interface UnparsedLine {
  code: string | null
  /** the full original description text, for review */
  description: string
  reason: 'no-dimension-found' | 'no-code-found'
}

export interface ExtractionResult {
  rows: HCRow[]
  unparsed: UnparsedLine[]
  totalDescriptionsRead: number
  totalRowsProduced: number
  totalRate: number
}

// ---------------------------------------------------------------------------
// Code-token segmentation
// ---------------------------------------------------------------------------

// A Code token: letters+digits (e.g. BT0107C), optionally digits-first
// (e.g. 451W), optionally with a second code after a slash
// (BT0020W/BT0020S). `\b` on both ends means it can only match a token that
// is ENTIRELY letters/digits with a real word boundary at each end — so it
// can never match a fragment from inside a dimension like "91X8" or "10X8"
// (those have no internal boundary to land on).
const CODE_TOKEN_RE = /\b([A-Za-z]+\d+[A-Za-z]*(?:\/[A-Za-z]+\d+[A-Za-z]*)?|\d+[A-Za-z]+)\b/g

// Words that share the same letter+digit shape as a real code but are
// actually units/descriptors (e.g. "30MM", "12CELL") — reject these so they
// never get mistaken for a new product code and split a segment wrongly.
const RESERVED_UNIT_WORDS = new Set(['MM', 'CELL', 'HC', 'INCH'])

function isRealCodeToken(token: string): boolean {
  const trailingLetters = token.match(/[A-Za-z]+$/)
  return !(trailingLetters && RESERVED_UNIT_WORDS.has(trailingLetters[0].toUpperCase()))
}

interface CodeSegment {
  code: string
  body: string
}

/** Splits raw text into one segment per Code token found, each segment's
 * body running from right after that code to right before the next one. */
function splitIntoCodeSegments(text: string): CodeSegment[] {
  const rawMatches = [...text.matchAll(CODE_TOKEN_RE)]
  const accepted: RegExpMatchArray[] = []

  for (const m of rawMatches) {
    const token = m[0]
    if (!isRealCodeToken(token)) continue

    // Some descriptions retype a short fragment of the current code before
    // each size group (e.g. "BT0357M 357M 34 18.5 ... 357M 28 9 ...") — a
    // shorter token that's just a substring of the code we're already in is
    // noise, not a genuinely new product code, so don't start a new segment.
    const prevCode = accepted[accepted.length - 1]?.[0]
    if (prevCode && token.length < prevCode.length && prevCode.toUpperCase().includes(token.toUpperCase())) {
      continue
    }

    accepted.push(m)
  }

  const segments: CodeSegment[] = []
  for (let i = 0; i < accepted.length; i++) {
    const current = accepted[i]
    const next = accepted[i + 1]
    const start = current.index! + current[0].length
    const end = next ? next.index! : text.length
    segments.push({ code: current[0], body: text.slice(start, end) })
  }

  return segments
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DimensionMatch {
  start: number
  end: number
  l: string
  w: string
}

/**
 * Some descriptions repeat a short fragment of the code before each size
 * group (a quirk of how the source data was typed), e.g.:
 *   "BT0357M 357M  34  18.5 (1) 25MM ...   357M  28  9 (1) 25MM ..."
 * "357M" here is noise, not a separate code — strip any standalone token
 * that is itself a substring of the main Code.
 */
function stripRepeatedCodeFragments(rest: string, code: string): string {
  const codeUpper = code.toUpperCase()
  const tokens = rest.split(/\s+/)
  const kept = tokens.filter((tok) => {
    if (tok.length < 2) return true
    if (!/[A-Za-z]/.test(tok)) return true // pure numbers/symbols always kept
    const cleaned = tok.replace(/[^A-Za-z0-9]/g, '')
    if (cleaned.length >= 2 && codeUpper.includes(cleaned.toUpperCase())) {
      return false // drop repeated code fragment
    }
    return true
  })
  return kept.join(' ')
}

/**
 * Finds every L x W dimension pair in the text. Handles:
 *  - explicit separators: 23.25X8, 9×5.5, 12x12
 *  - tab-mangled separators with no visible "x": "34  18.5 (1)" where two
 *    bare numbers are immediately followed by a quantity bracket
 */
function findDimensionMatches(text: string): DimensionMatch[] {
  const matches: DimensionMatch[] = []

  const reWithX = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = reWithX.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, l: m[1], w: m[2] })
  }

  const reBareBeforeBracket = /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(?=[([])/g
  while ((m = reBareBeforeBracket.exec(text)) !== null) {
    const overlaps = matches.some((mm) => m!.index < mm.end && m!.index + m![0].length > mm.start)
    if (!overlaps) {
      matches.push({ start: m.index, end: m.index + m[0].length, l: m[1], w: m[2] })
    }
  }

  matches.sort((a, b) => a.start - b.start)
  return matches
}

export function lookupRate(
  l: number,
  w: number,
  thicknessMm: number,
  cell: number,
  qty: number,
  grid: PriceGrid = PRICE_GRID,
): number | null {
  const row = grid[thicknessMm]
  if (!row) return null
  const pricePerM2 = row[cell]
  if (pricePerM2 === undefined) return null
  const rate = l * INCHES_TO_METRES * (w * INCHES_TO_METRES) * pricePerM2 * qty
  return Math.round(rate * 100) / 100
}

/** Single source of truth for why a row can't be trusted as-is. */
export function getFlagReason(row: Pick<HCRow, 'l' | 'w' | 'thicknessMm' | 'cell' | 'rate'>): string | null {
  if (Number.isNaN(row.l) || Number.isNaN(row.w)) return 'Missing dimension'
  if (row.thicknessMm === null || row.cell === null) return 'Missing thickness or cell'
  if (row.rate === null) return 'No price grid match'
  return null
}

// ---------------------------------------------------------------------------
// Core parser: one Code segment's body -> zero or more HCRow, or "unparsed"
// ---------------------------------------------------------------------------

function parseSegment(
  code: string,
  body: string,
  sourceDescription: string,
  grid: PriceGrid,
): { rows: HCRow[]; unparsed: UnparsedLine | null } {
  let rest = body.replace(/\t/g, ' ').replace(/×/g, 'x').replace(/\[/g, '(').replace(/\]/g, ')')
  rest = rest.replace(/\s+/g, ' ').trim()
  rest = stripRepeatedCodeFragments(rest, code)
  rest = rest.replace(/\s+/g, ' ').trim()

  const dims = findDimensionMatches(rest)

  // No dimension anywhere for this code (e.g. "BT0386H HONEYCOMB SET BY64")
  if (dims.length === 0) {
    return { rows: [], unparsed: { code, description: sourceDescription, reason: 'no-dimension-found' } }
  }

  const rows: HCRow[] = []

  for (let i = 0; i < dims.length; i++) {
    const dim = dims[i]
    const nextStart = i + 1 < dims.length ? dims[i + 1].start : rest.length
    const forward = rest.slice(dim.end, nextStart)
    const prevEnd = i > 0 ? dims[i - 1].end : 0
    const backward = rest.slice(prevEnd, dim.start)

    // Sheet Qty: a number in ( ) immediately after the dimension. Default 1.
    let sheetQty = 1
    const qtyMatch = forward.match(/^\s*\(\s*(\d+)\s*\)/)
    if (qtyMatch) sheetQty = parseInt(qtyMatch[1], 10)

    // Thickness + Cell: normally after the dimension...
    let thicknessMm: number | null = null
    let cell: number | null = null

    const thickForward = forward.match(/(\d+(?:\.\d+)?)\s*mm/i)
    const cellForward = forward.match(/(\d+)\s*cell/i)
    if (thickForward) thicknessMm = parseFloat(thickForward[1])
    if (cellForward) cell = parseInt(cellForward[1], 10)

    // ...but sometimes written BEFORE the dimension. Only safe to check this
    // when there's exactly one dimension in this segment (otherwise we'd
    // risk grabbing another size's thickness/cell).
    if ((thicknessMm === null || cell === null) && dims.length === 1) {
      const thickBackward = backward.match(/(\d+(?:\.\d+)?)\s*mm/i)
      const cellBackward = backward.match(/(\d+)\s*cell/i)
      if (thicknessMm === null && thickBackward) thicknessMm = parseFloat(thickBackward[1])
      if (cell === null && cellBackward) cell = parseInt(cellBackward[1], 10)
    }

    // No cell count anywhere in the description is a normal, expected case —
    // default to 12 rather than flagging it as unparseable, but keep a
    // record that it was assumed rather than read.
    let defaultedCell = false
    if (cell === null) {
      cell = 12
      defaultedCell = true
    }

    const l = parseFloat(dim.l)
    const w = parseFloat(dim.w)

    const rate = thicknessMm !== null && cell !== null ? lookupRate(l, w, thicknessMm, cell, sheetQty, grid) : null

    rows.push({
      code,
      l,
      w,
      thicknessMm,
      cell,
      sheetQty,
      rate,
      defaultedCell,
      sourceDescription,
    })
  }

  return { rows, unparsed: null }
}

// ---------------------------------------------------------------------------
// One description -> every code segment within it
// ---------------------------------------------------------------------------

export function parseDescription(
  description: string,
  grid: PriceGrid = PRICE_GRID,
): { rows: HCRow[]; unparsed: UnparsedLine[] } {
  const raw = description ?? ''
  const segments = splitIntoCodeSegments(raw)

  if (segments.length === 0) {
    return { rows: [], unparsed: [{ code: null, description: raw, reason: 'no-code-found' }] }
  }

  const rows: HCRow[] = []
  const unparsed: UnparsedLine[] = []

  for (const seg of segments) {
    const result = parseSegment(seg.code, seg.body, raw, grid)
    rows.push(...result.rows)
    if (result.unparsed) unparsed.push(result.unparsed)
  }

  // If nothing in this description produced a usable row, there's no real
  // size data anywhere in it — report that once for the whole description
  // rather than once per incidental code-shaped token in free-text notes
  // (e.g. "HONEYCOMB SET BY64" contains "BY64", which matches the code
  // pattern but is just descriptive text, not a second product).
  if (rows.length === 0 && unparsed.length > 1) {
    return { rows: [], unparsed: [unparsed[0]] }
  }

  return { rows, unparsed }
}

// ---------------------------------------------------------------------------
// Top-level entry point: array of description strings -> full result
// ---------------------------------------------------------------------------

export function extractHCRows(descriptions: string[], grid: PriceGrid = PRICE_GRID): ExtractionResult {
  const rows: HCRow[] = []
  const unparsed: UnparsedLine[] = []

  for (const desc of descriptions) {
    if (desc === null || desc === undefined || String(desc).trim() === '') continue
    const result = parseDescription(String(desc), grid)
    rows.push(...result.rows)
    unparsed.push(...result.unparsed)
  }

  // Deduplicate exact duplicate rows (same code + size + thickness/cell/qty)
  const seen = new Set<string>()
  const deduped = rows.filter((r) => {
    const key = `${r.code}|${r.l}|${r.w}|${r.thicknessMm}|${r.cell}|${r.sheetQty}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const totalRate = deduped.reduce((sum, r) => sum + (r.rate ?? 0), 0)

  return {
    rows: deduped,
    unparsed,
    totalDescriptionsRead: descriptions.filter((d) => d && String(d).trim() !== '').length,
    totalRowsProduced: deduped.length,
    totalRate: Math.round(totalRate * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// Excel/text input adapters
// ---------------------------------------------------------------------------

/**
 * Reads descriptions out of an uploaded workbook. Uses the "Description"
 * column by HEADER NAME (case-insensitive), not by fixed index — so this
 * keeps working even if column order changes in future exports.
 *
 * Expects a 2D array of cell values (row 0 = header row), which is what
 * libraries like SheetJS (`XLSX.utils.sheet_to_json(ws, { header: 1 })`)
 * or exceljs give you directly.
 */
export function getDescriptionsFromSheet(sheetRows: unknown[][]): string[] {
  if (sheetRows.length === 0) return []
  const header = sheetRows[0].map((h) => String(h ?? '').trim().toLowerCase())
  const descCol = header.indexOf('description')
  if (descCol === -1) {
    throw new Error('Could not find a "Description" column in the uploaded file.')
  }
  return sheetRows
    .slice(1)
    .map((row) => (row[descCol] !== undefined && row[descCol] !== null ? String(row[descCol]) : ''))
    .filter((v) => v.trim() !== '')
}

/**
 * "Paste text" input mode — one description per line, same format as the
 * Excel Description column.
 */
export function getDescriptionsFromPastedText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}
