// Client-side mirror of core.modules — keep in sync with the modules registered
// in supabase/migrations (0019 onward). Used for department grouping and, later,
// nav. The authoritative access levels come from core.my_module_access() (loaded
// into AuthContext); this file is just static metadata.
//
// Adding a module: register it in a migration AND add a row here. See
// docs/access-control.md → "Adding a new module".

export type AccessLevel = 'none' | 'view' | 'edit' | 'approve' | 'admin'

// Ordered — index position is the comparison rank.
export const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'edit', 'approve', 'admin']

export interface ModuleDef {
  key: string
  department: string
  label: string
  route: string
  parent?: string
}

export const MODULES: ModuleDef[] = [
  { key: 'purchase.honeycomb',            department: 'purchase', label: 'Honeycomb Calculator', route: '/purchase/honeycomb' },
  { key: 'purchase.honeycomb_history',    department: 'purchase', label: 'Extraction History',   route: '/purchase/honeycomb/history',    parent: 'purchase.honeycomb' },
  { key: 'purchase.honeycomb_price_grid', department: 'purchase', label: 'Price Grid',           route: '/purchase/honeycomb/price-grid', parent: 'purchase.honeycomb' },
  { key: 'purchase.marble',               department: 'purchase', label: 'Marble Costing',       route: '/purchase/marble-costing' },
  { key: 'purchase.users',                department: 'purchase', label: 'Purchase Users',       route: '/purchase/users' },

  { key: 'yaamya.wood_inward',            department: 'yaamya',   label: 'Wood Inward',          route: '/yaamya/wood-inward' },
  { key: 'yaamya.inward_log',             department: 'yaamya',   label: 'Inward Log',           route: '/yaamya/inward-log' },

  { key: 'sales.mcs',                     department: 'sales',    label: 'MCSP — Signed Samples', route: '/sales/mcsp/mcs' },
  { key: 'sales.mcp',                     department: 'sales',    label: 'MCSP — Counter Panels', route: '/sales/mcsp/mcp' },
  { key: 'sales.mcsp_validity',           department: 'sales',    label: 'Validity Requests',    route: '/sales/mcsp/validity-requests' },
  { key: 'sales.mcsp_shift',              department: 'sales',    label: 'Shift Requests',       route: '/sales/mcsp/shift-requests' },
  { key: 'sales.mcsp_recalls',            department: 'sales',    label: 'Recalls',              route: '/sales/mcsp/recalls' },
  { key: 'sales.mcsp_buyers',             department: 'sales',    label: 'MCSP Buyers',          route: '/sales/mcsp/buyers' },
  { key: 'sales.mcsp_halls',              department: 'sales',    label: 'MCSP Halls',           route: '/sales/mcsp/halls' },
  { key: 'sales.mcsp_users',              department: 'sales',    label: 'MCSP Users',           route: '/sales/mcsp/users' },
]

export function getModule(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key)
}

export function modulesForDepartment(department: string): ModuleDef[] {
  return MODULES.filter((m) => m.department === department)
}
