import { Link } from 'react-router-dom'
import { FileSpreadsheet, History, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function PurchaseHome() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Purchase</h1>
      <p className="text-sm text-text-secondary mb-6">Tools for the Purchase department.</p>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/purchase/hc-extraction"
          className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
        >
          <FileSpreadsheet size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">HC Sheet Extraction</p>
          <p className="text-xs text-text-secondary">Extract structured rows from honeycomb sheet product logs.</p>
        </Link>

        <Link
          to="/purchase/hc-extraction/history"
          className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
        >
          <History size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">History</p>
          <p className="text-xs text-text-secondary">Past extractions and their edit history.</p>
        </Link>

        {isAdmin && (
          <Link
            to="/purchase/settings/price-grid"
            className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
            <p className="text-sm font-medium text-text mb-0.5">Price Grid</p>
            <p className="text-xs text-text-secondary">Edit the HC sheet price grid used to calculate rates.</p>
          </Link>
        )}
      </div>
    </div>
  )
}
