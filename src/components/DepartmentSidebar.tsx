import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments, evaluateAccessRule, roleLabel } from '../lib/access'
import { getDepartment } from '../config/departments'
import type { ModuleSection } from '../config/moduleSections'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`

export default function DepartmentSidebar({
  activeDepartmentKey,
  sections,
}: {
  activeDepartmentKey: string
  sections: ModuleSection[]
}) {
  const { profile, permissionKeys, signOut } = useAuth()
  const navigate = useNavigate()
  const departments = accessibleDepartments(profile, permissionKeys)
  const activeDept = getDepartment(activeDepartmentKey)

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => evaluateAccessRule(item.access, profile, permissionKeys)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="px-5 py-5">
        <Link to="/" className="text-sm font-semibold tracking-tight text-text">
          BASANT Desk
        </Link>
      </div>

      <div className="px-3 pb-3">
        {departments.length > 1 ? (
          <select
            value={activeDepartmentKey}
            onChange={(e) => {
              const dept = getDepartment(e.target.value)
              if (dept) navigate(dept.route)
            }}
            className="w-full px-3 py-2 rounded-md text-sm bg-bg border border-border text-text"
          >
            {departments.map((dept) => (
              <option key={dept.key} value={dept.key}>
                {dept.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="px-3 py-2 text-sm text-text-secondary">{activeDept?.label}</div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.key}>
            <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.key} to={item.route} className={navItemClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text shrink-0">
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text truncate">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-text-secondary capitalize">{roleLabel(profile)}</p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="text-text-secondary hover:text-text transition-colors shrink-0"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
