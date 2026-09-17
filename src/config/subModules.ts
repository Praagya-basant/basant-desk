// Second-level breadcrumb entries for departments that have sub-modules
// (e.g. Purchase -> Honeycomb Calculator). Not every department needs this —
// only register one here once it actually has nested routes.
export interface SubModule {
  department: string
  route: string
  label: string
}

export const SUB_MODULES: SubModule[] = [
  { department: 'purchase', route: '/purchase/honeycomb', label: 'Honeycomb Calculator' },
  { department: 'purchase', route: '/purchase/marble-costing', label: 'Marble Costing' },
  { department: 'yaamya', route: '/yaamya/wood-inward', label: 'Wood Inward' },
  { department: 'yaamya', route: '/yaamya/inward-log', label: 'Inward Log' },
  { department: 'sales', route: '/sales/mcsp', label: 'MCSP' },
  { department: 'sales', route: '/sales/mcsp/mcs', label: 'Signed Samples' },
  { department: 'sales', route: '/sales/mcsp/mcp', label: 'Counter Panels' },
  { department: 'sales', route: '/sales/mcsp/buyers', label: 'Buyers' },
  { department: 'sales', route: '/sales/mcsp/halls', label: 'Halls' },
  { department: 'sales', route: '/sales/mcsp/users', label: 'Users' },
  { department: 'sales', route: '/sales/mcsp/validity-requests', label: 'Validity Requests' },
  { department: 'sales', route: '/sales/mcsp/shift-requests', label: 'Shift Requests' },
]

export function getSubModule(pathname: string): SubModule | undefined {
  return SUB_MODULES.find((m) => pathname === m.route || pathname.startsWith(`${m.route}/`))
}
