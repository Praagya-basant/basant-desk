import { useEffect, useMemo, useState } from 'react'
import { fetchDepartments } from '../lib/coreManagement/db'

/** Core Management's department list is exactly these 8 — not every row in
 * core.departments. core.departments is shared platform infrastructure
 * (purchase/production/sales/hr/yaamya/admin power the real department
 * switcher for other modules) plus a generic 'wip' key nothing ever used —
 * Core Management filters down to just what it needs rather than deleting
 * or renaming shared rows, which would risk breaking those other modules.
 * The WIP_* labels are overridden here to the exact casing requested
 * (ALL CAPS) without touching the underlying DB row, which other sessions
 * might reasonably have title-cased differently. */
const CORE_MANAGEMENT_DEPARTMENT_KEYS = [
  'sales',
  'purchase',
  'production',
  'operations',
  'wip_praagya',
  'wip_amit',
  'wip_others',
  'orange_tree',
]

const LABEL_OVERRIDES: Record<string, string> = {
  wip_praagya: 'WIP PRAAGYA',
  wip_amit: 'WIP AMIT',
  wip_others: 'WIP OTHERS',
}

export function useDepartments() {
  const [allDepartments, setAllDepartments] = useState<{ key: string; label: string }[]>([])

  useEffect(() => {
    fetchDepartments().then(setAllDepartments)
  }, [])

  const departments = useMemo(() => {
    const byKey = new Map(allDepartments.map((d) => [d.key, d]))
    return CORE_MANAGEMENT_DEPARTMENT_KEYS.filter((key) => byKey.has(key)).map((key) => ({
      key,
      label: LABEL_OVERRIDES[key] ?? byKey.get(key)!.label,
    }))
  }, [allDepartments])

  const labels = useMemo(() => new Map(departments.map((d) => [d.key, d.label])), [departments])

  return { departments, labels }
}
