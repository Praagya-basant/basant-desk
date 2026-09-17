import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Package, ArrowLeftRight, Layers, Building2, Warehouse, Users, CalendarClock, MoveRight, Undo2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import { countOpenRecalls } from '../../lib/mcsp/db'
import { navLinkClass } from './navLinkClass'

/** MCSP's contextual nav — MCS (samples) / MCP (panels) pill switcher, plus
 * the current area's pages, plus a Manage/Review section. This is the ONE
 * sidebar's content while inside /sales/mcsp/* — there is no second sidebar
 * rendered alongside it (see McspModule.tsx). */
export default function McspNav() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isSalesAdmin = isAdminOrDeptAdmin(profile, 'sales')
  const isManager = profile?.role === 'manager' && (profile.departments?.includes('sales') ?? false)
  const [openRecalls, setOpenRecalls] = useState(0)

  useEffect(() => {
    if (!isSalesAdmin) return
    countOpenRecalls().then(setOpenRecalls).catch(() => {})
  }, [isSalesAdmin, location.pathname])

  const activeArea = location.pathname.includes('/sales/mcsp/mcp')
    ? 'mcp'
    : location.pathname.includes('/sales/mcsp/mcs')
      ? 'mcs'
      : null

  return (
    <div>
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

      {activeArea !== null && (
        <nav className="space-y-0.5">
          {activeArea === 'mcs' ? (
            <>
              <NavLink to="/sales/mcsp/mcs" end className={navLinkClass}>
                <LayoutGrid size={16} strokeWidth={1.75} />
                Dashboard
              </NavLink>
              <NavLink to="/sales/mcsp/mcs/samples" className={navLinkClass}>
                <Package size={16} strokeWidth={1.75} />
                Samples
              </NavLink>
              <NavLink to="/sales/mcsp/mcs/movements" className={navLinkClass}>
                <ArrowLeftRight size={16} strokeWidth={1.75} />
                Movements
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/sales/mcsp/mcp" end className={navLinkClass}>
                <LayoutGrid size={16} strokeWidth={1.75} />
                Dashboard
              </NavLink>
              <NavLink to="/sales/mcsp/mcp/panels" className={navLinkClass}>
                <Layers size={16} strokeWidth={1.75} />
                Panels
              </NavLink>
              <NavLink to="/sales/mcsp/mcp/movements" className={navLinkClass}>
                <ArrowLeftRight size={16} strokeWidth={1.75} />
                Movements
              </NavLink>
            </>
          )}
        </nav>
      )}

      {(isSalesAdmin || isManager) && (
        <>
          <p className="mt-6 mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            {isSalesAdmin ? 'Manage' : 'Review'}
          </p>
          <nav className="space-y-0.5">
            {isSalesAdmin && (
              <>
                <NavLink to="/sales/mcsp/buyers" className={navLinkClass}>
                  <Building2 size={16} strokeWidth={1.75} />
                  Buyers
                </NavLink>
                <NavLink to="/sales/mcsp/halls" className={navLinkClass}>
                  <Warehouse size={16} strokeWidth={1.75} />
                  Halls
                </NavLink>
                <NavLink to="/sales/mcsp/users" className={navLinkClass}>
                  <Users size={16} strokeWidth={1.75} />
                  Users
                </NavLink>
              </>
            )}
            <NavLink to="/sales/mcsp/validity-requests" className={navLinkClass}>
              <CalendarClock size={16} strokeWidth={1.75} />
              Validity Requests
            </NavLink>
            <NavLink to="/sales/mcsp/shift-requests" className={navLinkClass}>
              <MoveRight size={16} strokeWidth={1.75} />
              Shift Requests
            </NavLink>
            {isSalesAdmin && (
              <NavLink to="/sales/mcsp/recalls" className={navLinkClass}>
                <Undo2 size={16} strokeWidth={1.75} />
                <span className="flex-1">Recalls</span>
                {openRecalls > 0 && (
                  <span className="flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-medium">
                    {openRecalls > 9 ? '9+' : openRecalls}
                  </span>
                )}
              </NavLink>
            )}
          </nav>
        </>
      )}
    </div>
  )
}
