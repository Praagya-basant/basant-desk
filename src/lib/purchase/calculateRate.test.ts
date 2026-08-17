import { describe, expect, it } from 'vitest'
import { rateRow, buildPriceGridLookup } from './calculateRate'
import type { PriceGridEntry } from './types'

const grid: PriceGridEntry[] = [
  { thicknessMm: 30, cell: 6, pricePerM2: 164 },
  { thicknessMm: 25, cell: 8, pricePerM2: 102 },
]

describe('rateRow', () => {
  it('computes rate = (L*0.0254) * (W*0.0254) * price * sheetQty, rounded to 2dp', () => {
    const lookup = buildPriceGridLookup(grid)
    const result = rateRow({ code: 'BT0601U', l: 31.25, w: 1.88, thicknessMm: 30, cell: 6, sheetQty: 4 }, lookup)
    expect(result.flagged).toBe(false)
    expect(result.rate).toBeCloseTo(24.86, 2)
  })

  it('flags a row when thickness/cell has no price grid match, without defaulting a price', () => {
    const lookup = buildPriceGridLookup(grid)
    const result = rateRow({ code: 'X', l: 24, w: 18, thicknessMm: 99, cell: 6, sheetQty: 1 }, lookup)
    expect(result.flagged).toBe(true)
    expect(result.flagReason).toBe('No price grid match')
    expect(result.rate).toBeNull()
  })

  it('flags a row with unparseable dimension/thickness/cell', () => {
    const lookup = buildPriceGridLookup(grid)
    const result = rateRow({ code: 'X', l: null, w: null, thicknessMm: null, cell: null, sheetQty: 1 }, lookup)
    expect(result.flagged).toBe(true)
    expect(result.rate).toBeNull()
  })
})
