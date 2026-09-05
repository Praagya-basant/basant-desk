import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Package, ArrowLeftRight, Layers, Building2, Warehouse, Users, CalendarClock, MoveRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`

/** MCSP's own module switcher + nav — MCS (samples) / MCP (panels) pill
 * tabs at top, matching what the standalone BASANT MCSP app used, styled
 * with the exact same tokens as the platform's main Sidebar/PurchaseModule
 * tab pattern (bg-surface/bg-bg/border-border) rather than any new pattern. */
export default function McspSidebar() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const canManage = isAdminOrDeptAdmin(profile, 'sales')

  const activeArea = location.pathname.includes('/sales/mcsp/mcp') ? 'mcp' : 'mcs'

  return (
    <aside className="w-52 shrink-0">
      <div className="flex rounded-md bg-surface border border-border p-1 mb-4">
        <button
          onClick={() => navigate('/sales/mcsp/mcs')}
          className={`flex-1 h-8 rounded text-sm font-medium transition-colors ${
            activeArea === 'mcs' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          MCS
        </button>
        <button
          onClick={() => navigate('/sales/mcsp/mcp')}
          className={`flex-1 h-8 rounded text-sm font-medium transition-colors ${
            activeArea === 'mcp' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          MCP
        </button>
      </div>

      <nav className="space-y-0.5">
        {activeArea === 'mcs' ? (
          <>
            <NavLink to="/sales/mcsp/mcs" end className={navItemClass}>
              <LayoutGrid size={15} strokeWidth={1.75} />
              Dashboard
            </NavLink>
            <NavLink to="/sales/mcsp/mcs/samples" className={navItemClass}>
              <Package size={15} strokeWidth={1.75} />
              Samples
            </NavLink>
            <NavLink to="/sales/mcsp/mcs/movements" className={navItemClass}>
              <ArrowLeftRight size={15} strokeWidth={1.75} />
              Movements
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/sales/mcsp/mcp" end className={navItemClass}>
              <LayoutGrid size={15} strokeWidth={1.75} />
              Dashboard
            </NavLink>
            <NavLink to="/sales/mcsp/mcp/panels" className={navItemClass}>
              <Layers size={15} strokeWidth={1.75} />
              Panels
            </NavLink>
            <NavLink to="/sales/mcsp/mcp/movements" className={navItemClass}>
              <ArrowLeftRight size={15} strokeWidth={1.75} />
              Movements
            </NavLink>
          </>
        )}
      </nav>

      {canManage && (
        <>
          <p className="mt-6 mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">Manage</p>
          <nav className="space-y-0.5">
            <NavLink to="/sales/mcsp/buyers" className={navItemClass}>
              <Building2 size={15} strokeWidth={1.75} />
              Buyers
            </NavLink>
            <NavLink to="/sales/mcsp/halls" className={navItemClass}>
              <Warehouse size={15} strokeWidth={1.75} />
              Halls
            </NavLink>
            <NavLink to="/sales/mcsp/users" className={navItemClass}>
              <Users size={15} strokeWidth={1.75} />
              Users
            </NavLink>
            <NavLink to="/sales/mcsp/validity-requests" className={navItemClass}>
              <CalendarClock size={15} strokeWidth={1.75} />
              Validity Requests
            </NavLink>
            <NavLink to="/sales/mcsp/shift-requests" className={navItemClass}>
              <MoveRight size={15} strokeWidth={1.75} />
              Shift Requests
            </NavLink>
          </nav>
        </>
      )}
    </aside>
  )
}
