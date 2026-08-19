import { Link } from 'react-router-dom'
import { Gem, Grid3x3, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import { useHasAccess } from '../../hooks/useHasAccess'

export default function PurchaseHome() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'purchase')
  const canUseHoneycomb = useHasAccess('purchase.hc_extraction')

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Purchase</h1>
      <p className="text-sm text-text-secondary mb-6">Modules for the Purchase department.</p>

      {!canUseHoneycomb && !canManage && (
        <p className="text-sm text-text-secondary mb-6">No modules assigned yet. Contact an admin to get access.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {canUseHoneycomb && (
          <Link
            to="/purchase/honeycomb"
            className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
          >
            <Grid3x3 size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
            <p className="text-sm font-medium text-text mb-0.5">Honeycomb Calculator</p>
            <p className="text-xs text-text-secondary">Extract and price honeycomb sheet orders.</p>
          </Link>
        )}

        <Link
          to="/purchase/marble-costing"
          className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
        >
          <Gem size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">Marble Costing</p>
          <p className="text-xs text-text-secondary">Costing tool for marble products.</p>
        </Link>

        {canManage && (
          <Link to="/purchase/users" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
            <Users size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
            <p className="text-sm font-medium text-text mb-0.5">Users</p>
            <p className="text-xs text-text-secondary">Manage users scoped to the Purchase department.</p>
          </Link>
        )}
      </div>
    </div>
  )
}
