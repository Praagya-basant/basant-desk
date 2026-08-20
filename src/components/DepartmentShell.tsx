import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Menu } from 'lucide-react'
import DepartmentSidebar from './DepartmentSidebar'
import TabBar from './TabBar'
import { useTabs } from '../hooks/useTabs'
import { getDepartment } from '../config/departments'
import { getModuleSections } from '../config/moduleSections'
import type { RouteTableEntry } from '../pages/purchase/purchaseRoutes'

export default function DepartmentShell({
  departmentKey,
  routeTable,
}: {
  departmentKey: string
  routeTable: RouteTableEntry[]
}) {
  const dept = getDepartment(departmentKey)
  const sections = getModuleSections(departmentKey)?.sections ?? []
  const { tabs, activeTabId, anchorTabId, activate, close } = useTabs(departmentKey, dept!, sections)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!dept) return null

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="hidden md:block">
        <DepartmentSidebar activeDepartmentKey={departmentKey} sections={sections} />
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">
            <DepartmentSidebar activeDepartmentKey={departmentKey} sections={sections} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 flex items-center gap-3 px-4 md:px-8 border-b border-border">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-text-secondary hover:text-text transition-colors"
            aria-label="Open navigation"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <span className="text-sm text-text-secondary">
            {dept.label}
            {activeTab && activeTab.id !== anchorTabId && (
              <>
                <span className="mx-1.5 text-border">/</span>
                <span className="text-text">{activeTab.label}</span>
              </>
            )}
          </span>
        </header>

        <TabBar tabs={tabs} activeTabId={activeTabId} anchorTabId={anchorTabId} onActivate={activate} onClose={close} />

        <main className="flex-1 min-w-0">
          {tabs.map((tab) => (
            <div key={tab.id} className="px-4 md:px-8 py-8" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
              <Routes location={tab.pathname}>
                {routeTable.map((entry) => (
                  <Route key={entry.path} path={entry.path} element={entry.element} />
                ))}
              </Routes>
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}
