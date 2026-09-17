import { NavLink } from 'react-router-dom'
import { Grid3x3, Gem, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import { useCan } from '../../hooks/useModuleAccess'
import { navLinkClass } from './navLinkClass'

export default function PurchaseNav() {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'purchase')
  const canUseHoneycomb = useCan('purchase.honeycomb', 'view')

  return (
    <div className="space-y-0.5">
      {canUseHoneycomb && (
        <NavLink to="/purchase/honeycomb" className={navLinkClass}>
          <Grid3x3 size={16} strokeWidth={1.75} />
          Honeycomb Calculator
        </NavLink>
      )}
      <NavLink to="/purchase/marble-costing" className={navLinkClass}>
        <Gem size={16} strokeWidth={1.75} />
        Marble Costing
      </NavLink>
      {canManage && (
        <NavLink to="/purchase/users" className={navLinkClass}>
          <Users size={16} strokeWidth={1.75} />
          Users
        </NavLink>
      )}
    </div>
  )
}
