import { Link } from 'react-router-dom'
import { ClipboardList, ScrollText } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'

export default function YaamyaHome() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'yaamya')

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Yaamya Industries</h1>
      <p className="text-sm text-text-secondary mb-6">Wood receiving for the Bhandu and Boranada yards.</p>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/yaamya/wood-inward"
          className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
        >
          <ClipboardList size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-text mb-0.5">Wood Inward</p>
          <p className="text-xs text-text-secondary">Measure and log incoming timber, piece by piece.</p>
        </Link>

        {canManage && (
          <Link
            to="/yaamya/inward-log"
            className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
          >
            <ScrollText size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
            <p className="text-sm font-medium text-text mb-0.5">Inward Log</p>
            <p className="text-xs text-text-secondary">Full receiving history, summaries and Excel export.</p>
          </Link>
        )}
      </div>
    </div>
  )
}
