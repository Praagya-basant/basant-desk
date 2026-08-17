import { describe, expect, it } from 'vitest'
import { extractHCRows } from './extractHCRows'

describe('extractHCRows', () => {
  it('splits a multi-size description into one row per size, from the spec worked example', () => {
    const input =
      'BT0601U 31.25X1.88 (4) 30MM HC SHEET 6 CELL 6.5X3 (2) 50MM HC SHEET 8 CELL 36X12 (2) 40MM HC SHEET 8 CELL 28X6.5 (1) 25MM HC SHEET 8 CELL'

    const rows = extractHCRows([input])

    expect(rows).toEqual([
      { code: 'BT0601U', l: 31.25, w: 1.88, thicknessMm: 30, cell: 6, sheetQty: 4 },
      { code: 'BT0601U', l: 6.5, w: 3, thicknessMm: 50, cell: 8, sheetQty: 2 },
      { code: 'BT0601U', l: 36, w: 12, thicknessMm: 40, cell: 8, sheetQty: 2 },
      { code: 'BT0601U', l: 28, w: 6.5, thicknessMm: 25, cell: 8, sheetQty: 1 },
    ])
  })

  it('defaults sheet qty to 1 when there is no parenthetical override', () => {
    const rows = extractHCRows(['BT0136J 24X18 30MM HC SHEET 8 CELL'])
    expect(rows).toEqual([{ code: 'BT0136J', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 }])
  })

  it('keeps slash-variant codes intact', () => {
    const rows = extractHCRows(['BT0020W/BT0020S 24X18 30MM 8CELL'])
    expect(rows[0].code).toBe('BT0020W/BT0020S')
  })

  it('reads bare numeric codes', () => {
    const rows = extractHCRows(['451W 24X18 30MM 8CELL', '576Q 24X18 30MM 8CELL'])
    expect(rows.map((r) => r.code)).toEqual(['451W', '576Q'])
  })

  it('strips trailing parenthetical markers on the code without treating them as sheet qty', () => {
    const rows = extractHCRows(['BT0136J (leg+shelf) 24X18 30MM 8CELL'])
    expect(rows).toEqual([{ code: 'BT0136J', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 }])
  })

  it('reads cell as numeric only, dropping leading zeros', () => {
    const rows = extractHCRows(['BT0136J 24X18 30MM 08CELL'])
    expect(rows[0].cell).toBe(8)
  })

  it('accepts *, x, X and tab as the L x W separator', () => {
    const rows = extractHCRows([
      'A1 24*18 30MM 8CELL',
      'A2 24x18 30MM 8CELL',
      'A3 24X18 30MM 8CELL',
      'A4 24\t18 30MM 8CELL',
    ])
    expect(rows.map((r) => [r.l, r.w])).toEqual([
      [24, 18],
      [24, 18],
      [24, 18],
      [24, 18],
    ])
  })

  it('handles thickness/cell written before the dimension', () => {
    const rows = extractHCRows(['BT0999 30MM 8 CELL 24X18'])
    expect(rows).toEqual([{ code: 'BT0999', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 }])
  })

  it('ignores INCH, inch marks, and free-text notes', () => {
    const rows = extractHCRows(['BT0136J 24"X18" INCH 30MM 8CELL Die Cut as per photo'])
    expect(rows).toEqual([{ code: 'BT0136J', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 }])
  })

  it('deduplicates exact duplicate rows', () => {
    const rows = extractHCRows(['BT0136J 24X18 30MM 8CELL', 'BT0136J 24X18 30MM 8CELL'])
    expect(rows).toHaveLength(1)
  })

  it('flags a line with no parseable dimension instead of dropping it silently', () => {
    const rows = extractHCRows(['BT0136J some unparsable note with no size'])
    expect(rows).toEqual([{ code: 'BT0136J', l: null, w: null, thicknessMm: null, cell: null, sheetQty: 1 }])
  })

  it('skips blank lines', () => {
    const rows = extractHCRows(['', '   ', 'BT0136J 24X18 30MM 8CELL'])
    expect(rows).toHaveLength(1)
  })
})
