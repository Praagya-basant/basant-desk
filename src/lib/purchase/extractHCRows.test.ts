import { describe, expect, it } from 'vitest'
import {
  extractHCRows,
  parseDescription,
  lookupRate,
  getFlagReason,
  getDescriptionsFromSheet,
  getDescriptionsFromPastedText,
  PRICE_GRID,
} from './extractHCRows'

describe('extractHCRows', () => {
  it('splits a multi-size description into one row per size, from the spec worked example', () => {
    const input =
      'BT0601U 31.25X1.88 (4) 30MM HC SHEET 6 CELL 6.5X3 (2) 50MM HC SHEET 8 CELL 36X12 (2) 40MM HC SHEET 8 CELL 28X6.5 (1) 25MM HC SHEET 8 CELL'

    const { rows, unparsed } = extractHCRows([input])

    expect(unparsed).toEqual([])
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => [r.code, r.l, r.w, r.thicknessMm, r.cell, r.sheetQty])).toEqual([
      ['BT0601U', 31.25, 1.88, 30, 6, 4],
      ['BT0601U', 6.5, 3, 50, 8, 2],
      ['BT0601U', 36, 12, 40, 8, 2],
      ['BT0601U', 28, 6.5, 25, 8, 1],
    ])
    expect(rows.map((r) => r.rate)).toEqual([24.86, 3.93, 75.25, 11.98])
  })

  it('reads bare numeric codes and defaults sheet qty to 1', () => {
    const { rows } = extractHCRows(['451W 24X18 30MM 8CELL'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: '451W', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 })
    expect(rows[0].rate).toBeCloseTo(lookupRate(24, 18, 30, 8, 1)!, 2)
  })

  it('keeps slash-variant codes intact', () => {
    const { rows } = extractHCRows(['BT0020W/BT0020S 24X18 30MM 8CELL'])
    expect(rows[0].code).toBe('BT0020W/BT0020S')
  })

  it('reads cell as numeric only, dropping leading zeros', () => {
    const { rows } = extractHCRows(['BT0136J 24X18 30MM 08CELL'])
    expect(rows[0].cell).toBe(8)
  })

  it('accepts */x/X and tab-mangled bare-number dimensions', () => {
    const { rows } = extractHCRows(['A2 24x18 30MM 8CELL', 'A3 24X18 30MM 8CELL', 'A4\t24\t18\t(1) 30MM 8CELL'])
    expect(rows.map((r) => [r.l, r.w])).toEqual([
      [24, 18],
      [24, 18],
      [24, 18],
    ])
  })

  it('reads thickness/cell written before the dimension when there is only one size in the line', () => {
    const { rows } = extractHCRows(['BT0999 30MM 8 CELL 24X18'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: 'BT0999', l: 24, w: 18, thicknessMm: 30, cell: 8, sheetQty: 1 })
  })

  it('strips a repeated code fragment retyped before a size group', () => {
    const { rows } = extractHCRows(['BT0357M 357M 34 18.5 (1) 25MM HC SHEET 8 CELL'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: 'BT0357M', l: 34, w: 18.5, thicknessMm: 25, cell: 8, sheetQty: 1 })
  })

  it('flags a line with no dimension anywhere instead of dropping it silently', () => {
    const { rows, unparsed } = extractHCRows(['BT0386H HONEYCOMB SET BY64'])
    expect(rows).toEqual([])
    expect(unparsed).toEqual([{ code: 'BT0386H', description: 'BT0386H HONEYCOMB SET BY64', reason: 'no-dimension-found' }])
  })

  it('flags a line with no leading code', () => {
    const { rows, unparsed } = extractHCRows(['----'])
    expect(rows).toEqual([])
    expect(unparsed).toEqual([{ code: null, description: '----', reason: 'no-code-found' }])
  })

  it('skips blank lines entirely, not counting them as read or unparsed', () => {
    const result = extractHCRows(['', '   ', 'BT0136J 24X18 30MM 8CELL'])
    expect(result.totalDescriptionsRead).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.unparsed).toEqual([])
  })

  it('computes totals across rows and unparsed lines together', () => {
    const result = extractHCRows(['BT0136J 24X18 30MM 8CELL', 'BT0386H HONEYCOMB SET BY64'])
    expect(result.totalDescriptionsRead).toBe(2)
    expect(result.totalRowsProduced).toBe(1)
    expect(result.unparsed).toHaveLength(1)
    expect(result.totalRate).toBeCloseTo(result.rows[0].rate!, 2)
  })

  it('defaults cell to 12 and flags it as defaulted when no cell count is found', () => {
    const { rows } = extractHCRows(['BT0136J 24X18 30MM'])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: 'BT0136J', l: 24, w: 18, thicknessMm: 30, cell: 12, defaultedCell: true })
  })

  it('does not mark cell as defaulted when a cell count was actually read', () => {
    const { rows } = extractHCRows(['BT0136J 24X18 30MM 8CELL'])
    expect(rows[0]).toMatchObject({ cell: 8, defaultedCell: false })
  })

  it('uses the passed-in price grid instead of the default constant', () => {
    const customGrid = { 30: { 6: 1000 } }
    const { rows } = extractHCRows(['BT0136J 24X18 30MM 6CELL'], customGrid)
    expect(rows[0].rate).not.toBeCloseTo(lookupRate(24, 18, 30, 6, 1, PRICE_GRID)!, 2)
    expect(rows[0].rate).toBeCloseTo(lookupRate(24, 18, 30, 6, 1, customGrid)!, 2)
  })

  it('splits multiple product codes pasted in one block into separate groups, never merging them under the first code', () => {
    const input =
      'BT0492E 91X8 (2) 30MM HC SHEET 12 CELL 91X10 (2) 30MM HC SHEET 12 CELL 10X8 (2) 30MM HC SHEET 12 CELL BT0622S 11X5 (1) 60MM HC SHEET 8 CELL 14X6 (1) 25MM HC SHEET 8 CELL'

    const { rows, unparsed } = extractHCRows([input])

    expect(unparsed).toEqual([])
    expect(rows).toHaveLength(5)

    const bt0492e = rows.filter((r) => r.code === 'BT0492E')
    const bt0622s = rows.filter((r) => r.code === 'BT0622S')

    expect(bt0492e).toHaveLength(3)
    expect(bt0492e.every((r) => r.thicknessMm === 30 && r.cell === 12)).toBe(true)
    expect(bt0492e.map((r) => [r.l, r.w])).toEqual([
      [91, 8],
      [91, 10],
      [10, 8],
    ])

    expect(bt0622s).toHaveLength(2)
    expect(bt0622s.map((r) => [r.l, r.w, r.thicknessMm, r.cell])).toEqual([
      [11, 5, 60, 8],
      [14, 6, 25, 8],
    ])
  })

  it('does not mistake a thickness value like "30MM" for a product code', () => {
    const { rows } = extractHCRows(['BT0136J 24X18 30MM 8CELL'])
    expect(rows).toHaveLength(1)
    expect(rows[0].code).toBe('BT0136J')
  })
})

describe('parseDescription', () => {
  it('returns an unparsed entry for an empty-ish description with no code', () => {
    const { unparsed } = parseDescription('')
    expect(unparsed).toEqual([{ code: null, description: '', reason: 'no-code-found' }])
  })
})

describe('lookupRate', () => {
  it('computes rate = (L*0.0254) * (W*0.0254) * price * sheetQty, rounded to 2dp', () => {
    expect(lookupRate(31.25, 1.88, 30, 6, 4)).toBeCloseTo(24.86, 2)
  })

  it('returns null when thickness or cell has no match in the grid, without defaulting a price', () => {
    expect(lookupRate(24, 18, 99, 6, 1)).toBeNull()
    expect(lookupRate(24, 18, 30, 99, 1)).toBeNull()
  })
})

describe('getFlagReason', () => {
  it('flags missing dimension, missing thickness/cell, and no grid match distinctly', () => {
    expect(getFlagReason({ l: NaN, w: 18, thicknessMm: 30, cell: 6, rate: 1 })).toBe('Missing dimension')
    expect(getFlagReason({ l: 24, w: 18, thicknessMm: null, cell: 6, rate: null })).toBe('Missing thickness or cell')
    expect(getFlagReason({ l: 24, w: 18, thicknessMm: 99, cell: 6, rate: null })).toBe('No price grid match')
    expect(getFlagReason({ l: 24, w: 18, thicknessMm: 30, cell: 6, rate: 24.86 })).toBeNull()
  })
})

describe('getDescriptionsFromSheet', () => {
  it('finds the Description column by header name, regardless of position', () => {
    const sheet = [
      ['Order Reference', 'Buyer', 'Description'],
      ['REF-1', 'MDM', 'BT0136J 24X18 30MM 8CELL'],
      ['REF-2', 'MDM', 'BT0601U 6.5X3 50MM 8CELL'],
    ]
    expect(getDescriptionsFromSheet(sheet)).toEqual(['BT0136J 24X18 30MM 8CELL', 'BT0601U 6.5X3 50MM 8CELL'])
  })

  it('matches the header case-insensitively', () => {
    const sheet = [['DESCRIPTION'], ['BT0136J 24X18 30MM 8CELL']]
    expect(getDescriptionsFromSheet(sheet)).toEqual(['BT0136J 24X18 30MM 8CELL'])
  })

  it('throws when no Description column exists', () => {
    expect(() => getDescriptionsFromSheet([['Order Reference'], ['REF-1']])).toThrow(/Description/)
  })

  it('returns an empty array for an empty sheet', () => {
    expect(getDescriptionsFromSheet([])).toEqual([])
  })
})

describe('getDescriptionsFromPastedText', () => {
  it('splits on newlines, trims, and drops blank lines', () => {
    expect(getDescriptionsFromPastedText('  BT0136J 24X18 30MM 8CELL  \n\n  \nBT0601U 6.5X3 50MM 8CELL')).toEqual([
      'BT0136J 24X18 30MM 8CELL',
      'BT0601U 6.5X3 50MM 8CELL',
    ])
  })
})
