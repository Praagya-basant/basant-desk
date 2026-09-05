import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'

// Sales department landing — clean module-card grid, no data/tables/stats
// shown before a module is entered, same visual pattern as the main
// dashboard's department cards (Welcome.tsx). Only one block for now.
export default function SalesHome() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Sales</h1>
      <p className="text-sm text-text-secondary mb-6">Modules for the Sales department.</p>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sales/mcsp" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
          <Layers size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">MCSP — Signed Samples &amp; Panels</p>
          <p className="text-xs text-text-secondary">Track signed samples and counter panels across every hall.</p>
        </Link>
      </div>
    </div>
  )
}
