import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPriceGrid, upsertPriceGridEntry } from '../../lib/purchase/db'
import type { PriceGridRow } from '../../lib/purchase/dbTypes'

const CELLS = [6, 8, 12]

export default function PriceGridSettings() {
  const { profile } = useAuth()
  const [grid, setGrid] = useState<PriceGridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    fetchPriceGrid()
      .then(setGrid)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const thicknesses = [...new Set(grid.map((g) => g.thickness_mm))].sort((a, b) => a - b)

  function priceFor(thickness: number, cell: number) {
    return grid.find((g) => g.thickness_mm === thickness && g.cell === cell)?.price_per_m2 ?? null
  }

  function updateLocal(thickness: number, cell: number, value: number) {
    setGrid((prev) =>
      prev.map((g) => (g.thickness_mm === thickness && g.cell === cell ? { ...g, price_per_m2: value } : g)),
    )
  }

  async function commit(thickness: number, cell: number, value: number) {
    if (!profile) return
    const key = `${thickness}_${cell}`
    setSavingKey(key)
    setError(null)
    try {
      await upsertPriceGridEntry(thickness, cell, value, profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that price.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Price Grid</h1>
      <p className="text-sm text-text-secondary mb-6">
        Price per m² by thickness and cell count. Changes save immediately.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Thickness (mm)</th>
              {CELLS.map((cell) => (
                <th key={cell} className="font-medium px-4 py-2.5 text-center">
                  {cell} cell
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {thicknesses.map((thickness) => (
              <tr key={thickness} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-text">{thickness}</td>
                {CELLS.map((cell) => {
                  const key = `${thickness}_${cell}`
                  const value = priceFor(thickness, cell)
                  return (
                    <td key={cell} className="px-4 py-2.5 text-center">
                      <input
                        value={value ?? ''}
                        onChange={(e) => updateLocal(thickness, cell, Number(e.target.value))}
                        onBlur={(e) => commit(thickness, cell, Number(e.target.value))}
                        className="w-16 bg-transparent outline-none border-b border-transparent focus:border-border text-center tabular-nums"
                      />
                      {savingKey === key && <span className="text-xs text-text-secondary ml-1">saving…</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
