import { NavLink } from 'react-router-dom'
import { ClipboardList, ScrollText } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import { navLinkClass } from './navLinkClass'

export default function YaamyaNav() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'yaamya')

  return (
    <div className="space-y-0.5">
      <NavLink to="/yaamya/wood-inward" className={navLinkClass}>
        <ClipboardList size={16} strokeWidth={1.75} />
        Wood Inward
      </NavLink>
      {canManage && (
        <NavLink to="/yaamya/inward-log" className={navLinkClass}>
          <ScrollText size={16} strokeWidth={1.75} />
          Inward Log
        </NavLink>
      )}
    </div>
  )
}
