import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cm-sidebar-collapsed'

/** Collapsible sidebar state, persisted, toggleable via Ctrl/Cmd+B — the
 * same shortcut convention as most editors/IDEs, so it's not something
 * users have to learn fresh. */
export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // ignore — collapse state just won't persist
    }
  }, [collapsed])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { collapsed, toggle: () => setCollapsed((c) => !c) }
}
