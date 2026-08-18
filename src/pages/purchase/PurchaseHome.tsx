import { Link } from 'react-router-dom'
import { FileSpreadsheet, History, SlidersHorizontal, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import { useHasAccess } from '../../hooks/useHasAccess'

export default function PurchaseHome() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'purchase')
  const canUseHCExtraction = useHasAccess('purchase.hc_extraction')

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Purchase</h1>
      <p className="text-sm text-text-secondary mb-6">Tools for the Purchase department.</p>

      {!canUseHCExtraction && !canManage && (
        <p className="text-sm text-text-secondary mb-6">
          No tools assigned yet. Contact an admin to get access.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {canUseHCExtraction && (
          <>
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
          </>
        )}

        {canManage && (
          <>
            <Link
              to="/purchase/settings/price-grid"
              className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
            >
              <SlidersHorizontal size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text mb-0.5">Price Grid</p>
              <p className="text-xs text-text-secondary">Edit supplier price grids used to calculate rates.</p>
            </Link>

            <Link
              to="/purchase/settings/users"
              className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
            >
              <Users size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text mb-0.5">Users</p>
              <p className="text-xs text-text-secondary">Manage users scoped to the Purchase department.</p>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
