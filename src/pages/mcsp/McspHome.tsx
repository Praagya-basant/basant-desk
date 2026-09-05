import { Link } from 'react-router-dom'
import { Package, ArrowLeftRight, Building2, Warehouse, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'

export default function McspHome() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'mcsp')

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">MCSP</h1>
      <p className="text-sm text-text-secondary mb-6">Signed sample tracking for the sample halls.</p>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/mcsp/samples" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
          <Package size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">Samples</p>
          <p className="text-xs text-text-secondary">Add, issue, return and forward signed samples.</p>
        </Link>

        <Link to="/mcsp/movements" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
          <ArrowLeftRight size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">Movements</p>
          <p className="text-xs text-text-secondary">Full checkout / return / forward history.</p>
        </Link>

        {canManage && (
          <>
            <Link to="/mcsp/buyers" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
              <Building2 size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text mb-0.5">Buyers</p>
              <p className="text-xs text-text-secondary">Companies whose samples are signed in.</p>
            </Link>

            <Link to="/mcsp/halls" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
              <Warehouse size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text mb-0.5">Halls</p>
              <p className="text-xs text-text-secondary">Sample halls samples are signed into.</p>
            </Link>

            <Link to="/mcsp/users" className="border border-border rounded-lg p-4 hover:bg-surface transition-colors">
              <Users size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text mb-0.5">Users</p>
              <p className="text-xs text-text-secondary">Manage users scoped to MCSP.</p>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
