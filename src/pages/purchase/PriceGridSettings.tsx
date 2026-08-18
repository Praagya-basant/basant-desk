import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPriceGrid, upsertPriceGridEntry } from '../../lib/purchase/db'
import type { PriceGridRow } from '../../lib/purchase/dbTypes'

const CELLS = [6, 8, 12]

export default function PriceGridSettings() {
  const { profile } = useAuth()
  const [grid, setGrid] = useState<PriceGridRow[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [supplier, setSupplier] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    fetchPriceGrid()
      .then((rows) => {
        setGrid(rows)
        const distinctSuppliers = Array.from(new Set(rows.map((r) => r.supplier))).sort()
        setSuppliers(distinctSuppliers)
        setSupplier(distinctSuppliers[0] ?? '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // The full set of thickness rows to render, regardless of which supplier
  // is selected — a brand-new supplier starts with every cell blank rather
  // than having no rows to fill in at all.
  const thicknesses = [...new Set(grid.map((g) => g.thickness_mm))].sort((a, b) => a - b)

  function priceFor(thickness: number, cell: number) {
    return grid.find((g) => g.supplier === supplier && g.thickness_mm === thickness && g.cell === cell)?.price_per_m2 ?? null
  }

  function updateLocal(thickness: number, cell: number, value: number) {
    setGrid((prev) => {
      const exists = prev.some((g) => g.supplier === supplier && g.thickness_mm === thickness && g.cell === cell)
      if (exists) {
        return prev.map((g) =>
          g.supplier === supplier && g.thickness_mm === thickness && g.cell === cell ? { ...g, price_per_m2: value } : g,
        )
      }
      return [
        ...prev,
        { supplier, thickness_mm: thickness, cell, price_per_m2: value, updated_by: null, updated_at: new Date().toISOString() },
      ]
    })
  }

  async function commit(thickness: number, cell: number, value: number) {
    if (!profile || !supplier) return
    const key = `${thickness}_${cell}`
    setSavingKey(key)
    setError(null)
    try {
      await upsertPriceGridEntry(supplier, thickness, cell, value, profile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that price.')
    } finally {
      setSavingKey(null)
    }
  }

  function confirmNewSupplier() {
    const name = newSupplierName.trim()
    if (!name) return
    if (!suppliers.includes(name)) {
      setSuppliers((prev) => [...prev, name].sort())
    }
    setSupplier(name)
    setNewSupplierName('')
    setAddingSupplier(false)
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Price Grid</h1>
      <p className="text-sm text-text-secondary mb-6">
        Price per m² by thickness and cell count, per supplier. Changes save immediately.
      </p>

      <div className="flex items-end gap-2 mb-6">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Supplier</label>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
          >
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {addingSupplier ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmNewSupplier()}
              placeholder="Supplier name"
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
            />
            <button
              onClick={confirmNewSupplier}
              className="rounded-md bg-text text-bg text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAddingSupplier(false)
                setNewSupplierName('')
              }}
              className="text-sm text-text-secondary hover:text-text transition-colors px-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSupplier(true)}
            className="flex items-center gap-1.5 rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            New supplier
          </button>
        )}
      </div>

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
                        onBlur={(e) => e.target.value !== '' && commit(thickness, cell, Number(e.target.value))}
                        placeholder="—"
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
