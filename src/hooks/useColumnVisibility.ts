import { useEffect, useState } from 'react'
import type { TaskColumnKey } from '../lib/coreManagement/columns'

/** Persists which columns are shown, per view — a UI preference, not
 * sensitive data, so plain localStorage is fine. One shared set per view,
 * governing both the on-screen table and Print/PDF/Excel output, so
 * toggling a column on shows it everywhere at once. */
export function useColumnVisibility(viewKey: string, defaults: TaskColumnKey[]) {
  const storageKey = `cm-columns:${viewKey}`

  const [visible, setVisible] = useState<Set<TaskColumnKey>>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return new Set(JSON.parse(stored) as TaskColumnKey[])
    } catch {
      // fall through to defaults
    }
    return new Set(defaults)
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...visible]))
    } catch {
      // localStorage unavailable (private mode etc.) — visibility just won't persist
    }
  }, [storageKey, visible])

  function toggle(key: TaskColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return { visible, toggle }
}
