import { useEffect, useState } from 'react'
import { Plus, ImageOff } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { listPanels } from '../../../lib/mcsp/db'
import { getValidityStatus } from '../../../lib/mcsp/dbTypes'
import type { PanelWithRelations } from '../../../lib/mcsp/dbTypes'
import { StatusBadge, ValidityBadge } from '../Badges'
import AddPanelModal from './AddPanelModal'
import PanelDrawer from './PanelDrawer'
import { exportPanelsToExcel } from '../../../lib/mcsp/exportExcel'

type FilterTab = 'all' | 'in_hall' | 'issued' | 'expiring_soon' | 'retired'

export default function Panels() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'sales') || profile?.role === 'manager'

  const [panels, setPanels] = useState<PanelWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<PanelWithRelations | null>(null)

  async function load() {
    setLoading(true)
    try {
      setPanels(await listPanels())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load panels.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = panels.filter((p) => {
    if (filter === 'retired') return p.status === 'retired'
    if (p.status === 'retired') return false // archived — never in the active list
    if (filter === 'in_hall' && p.status !== 'in_hall') return false
    if (filter === 'issued' && p.status !== 'issued') return false
    if (filter === 'expiring_soon' && getValidityStatus(p.expiry_date) !== 'expiring_soon') return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (p.panel_code ?? '').toLowerCase().includes(q) || p.panel_name.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Panels</h1>
          <p className="text-sm text-text-secondary mt-0.5">Counter panels across every hall.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportPanelsToExcel(filtered)} className="rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface transition-colors">
            Export
          </button>
          {canManage && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors">
              <Plus size={15} strokeWidth={2} />
              Add Panel
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search panel code or name…"
          className="w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
        />
        <div className="flex gap-1 border border-border rounded-md p-1 bg-surface">
          {([
            ['all', 'All'],
            ['in_hall', 'In Hall'],
            ['issued', 'Issued'],
            ['expiring_soon', 'Expiring Soon'],
            ['retired', 'Retired'],
          ] as [FilterTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === key ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5"></th>
              <th className="font-medium px-4 py-2.5">Panel Code</th>
              <th className="font-medium px-4 py-2.5">Name</th>
              <th className="font-medium px-4 py-2.5">Buyer</th>
              <th className="font-medium px-4 py-2.5">Hall</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">No panels found.</td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p)} className="border-b border-border last:border-0 cursor-pointer hover:bg-surface transition-colors">
                  <td className="px-4 py-2">
                    <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center overflow-hidden">
                      {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageOff size={14} strokeWidth={1.5} className="text-text-muted" />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text font-mono">{p.panel_code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text">{p.panel_name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{p.buyer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{p.hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <ValidityBadge expiryDate={p.expiry_date} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddPanelModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            load()
          }}
        />
      )}

      {selected && (
        <PanelDrawer
          panel={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            load()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
