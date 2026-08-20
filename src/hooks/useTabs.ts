import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { evaluateAccessRule } from '../lib/access'
import type { Department } from '../config/departments'
import type { ModuleItem, ModuleSection } from '../config/moduleSections'

export interface TabDescriptor {
  id: string
  itemKey: string
  label: string
  pathname: string
}

interface TabsState {
  tabs: TabDescriptor[]
  activeTabId: string
}

interface StoredTabs {
  version: 1
  activeTabId: string
  tabs: TabDescriptor[]
}

function storageKey(userId: string, departmentKey: string) {
  return `basant-desk:tabs:${userId}:${departmentKey}`
}

function makeTab(departmentKey: string, item: ModuleItem, pathname = item.route): TabDescriptor {
  return { id: `${departmentKey}:${item.key}`, itemKey: item.key, label: item.label, pathname }
}

function readStored(key: string): StoredTabs | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTabs
    if (parsed.version === 1 && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) return parsed
  } catch {
    // ignore malformed storage
  }
  return null
}

/**
 * Owns the open-tabs state for one department shell: which module items have
 * an open tab, which one is active, and restoring/persisting that set to
 * sessionStorage per user+department. The "anchor" tab (whichever item
 * resolves to the department's own root route, e.g. the department home page)
 * is always present and can't be closed, so the tab strip is never empty.
 */
export function useTabs(departmentKey: string, dept: Department, sections: ModuleSection[]) {
  const { profile, permissionKeys } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const allItems = useMemo<ModuleItem[]>(() => {
    const configured = sections.flatMap((s) => s.items)
    const hasHome = configured.some((i) => i.route === dept.route)
    return hasHome
      ? configured
      : [{ key: '__home__', label: dept.label, route: dept.route, access: { type: 'public' } }, ...configured]
  }, [sections, dept.route, dept.label])

  const visibleItems = useMemo(
    () => allItems.filter((i) => evaluateAccessRule(i.access, profile, permissionKeys)),
    [allItems, profile, permissionKeys],
  )

  const anchorItem = useMemo(
    () => visibleItems.find((i) => i.route === dept.route) ?? allItems.find((i) => i.key === '__home__') ?? allItems[0],
    [visibleItems, allItems, dept.route],
  )

  const userId = profile?.id ?? ''
  const persistKey = userId ? storageKey(userId, departmentKey) : null

  const [state, setState] = useState<TabsState>(() => {
    const anchorTab = makeTab(departmentKey, anchorItem)
    const stored = persistKey ? readStored(persistKey) : null
    if (!stored) return { tabs: [anchorTab], activeTabId: anchorTab.id }

    const validKeys = new Set(visibleItems.map((i) => i.key))
    const restored = stored.tabs.filter((t) => validKeys.has(t.itemKey) || t.itemKey === anchorItem.key)
    const tabs = restored.some((t) => t.itemKey === anchorItem.key) ? restored : [anchorTab, ...restored]
    const activeTabId = tabs.some((t) => t.id === stored.activeTabId) ? stored.activeTabId : tabs[0].id
    return { tabs, activeTabId }
  })

  // Reconcile open tabs against the current URL: open (or focus) whichever
  // tab owns this pathname, using longest-prefix match over configured items.
  useEffect(() => {
    const pathname = location.pathname
    const owning =
      [...visibleItems]
        .filter((i) => pathname === i.route || pathname.startsWith(`${i.route}/`))
        .sort((a, b) => b.route.length - a.route.length)[0] ?? anchorItem

    setState((prev) => {
      const existing = prev.tabs.find((t) => t.itemKey === owning.key)
      if (existing) {
        if (existing.pathname === pathname && prev.activeTabId === existing.id) return prev
        return {
          tabs: prev.tabs.map((t) => (t.id === existing.id ? { ...t, pathname } : t)),
          activeTabId: existing.id,
        }
      }
      const newTab = makeTab(departmentKey, owning, pathname)
      return { tabs: [...prev.tabs, newTab], activeTabId: newTab.id }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Persist on every change.
  useEffect(() => {
    if (!persistKey) return
    const payload: StoredTabs = { version: 1, activeTabId: state.activeTabId, tabs: state.tabs }
    sessionStorage.setItem(persistKey, JSON.stringify(payload))
  }, [persistKey, state])

  // activate/close change the active tab in response to a UI action (not a
  // browser navigation), so they drive the URL themselves via navigate();
  // that in turn re-fires the reconciliation effect above, which is a no-op
  // once the tab list already agrees with the new location.
  const activate = useCallback(
    (tabId: string) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return
      setState((prev) => ({ ...prev, activeTabId: tabId }))
      if (tab.pathname !== location.pathname) navigate(tab.pathname)
    },
    [state.tabs, location.pathname, navigate],
  )

  const close = useCallback(
    (tabId: string) => {
      if (tabId === `${departmentKey}:${anchorItem.key}`) return
      const index = state.tabs.findIndex((t) => t.id === tabId)
      if (index === -1) return

      const tabs = state.tabs.filter((t) => t.id !== tabId)
      const wasActive = state.activeTabId === tabId
      const nextActive = wasActive ? (tabs[index - 1] ?? tabs[index] ?? tabs[0]) : undefined

      setState({ tabs, activeTabId: wasActive && nextActive ? nextActive.id : state.activeTabId })
      if (wasActive && nextActive && nextActive.pathname !== location.pathname) navigate(nextActive.pathname)
    },
    [departmentKey, anchorItem.key, state.tabs, state.activeTabId, location.pathname, navigate],
  )

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    anchorTabId: `${departmentKey}:${anchorItem.key}`,
    activate,
    close,
  }
}
