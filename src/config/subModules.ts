// Breadcrumb entries for routes nested under a department (e.g.
// Purchase -> Honeycomb Calculator -> History). Not every route needs one —
// only register a level here once it's worth a crumb; deeper leaf pages
// (a single record's detail view) don't need their own entry.
export interface SubModule {
  department: string
  route: string
  label: string
}

export const SUB_MODULES: SubModule[] = [
  { department: 'purchase', route: '/purchase/honeycomb', label: 'Honeycomb Calculator' },
  { department: 'purchase', route: '/purchase/honeycomb/extraction', label: 'Extraction' },
  { department: 'purchase', route: '/purchase/honeycomb/history', label: 'History' },
  { department: 'purchase', route: '/purchase/honeycomb/price-grid', label: 'Price Grid' },
  { department: 'purchase', route: '/purchase/marble-costing', label: 'Marble Costing' },
  { department: 'purchase', route: '/purchase/users', label: 'Users' },
  { department: 'yaamya', route: '/yaamya/wood-inward', label: 'Wood Inward' },
  { department: 'yaamya', route: '/yaamya/inward-log', label: 'Inward Log' },
  { department: 'sales', route: '/sales/mcsp', label: 'MCSP' },
  { department: 'sales', route: '/sales/mcsp/mcs', label: 'Signed Samples' },
  { department: 'sales', route: '/sales/mcsp/mcs/samples', label: 'Samples' },
  { department: 'sales', route: '/sales/mcsp/mcs/movements', label: 'Movements' },
  { department: 'sales', route: '/sales/mcsp/mcp', label: 'Counter Panels' },
  { department: 'sales', route: '/sales/mcsp/mcp/panels', label: 'Panels' },
  { department: 'sales', route: '/sales/mcsp/mcp/movements', label: 'Movements' },
  { department: 'sales', route: '/sales/mcsp/buyers', label: 'Buyers' },
  { department: 'sales', route: '/sales/mcsp/halls', label: 'Halls' },
  { department: 'sales', route: '/sales/mcsp/users', label: 'Users' },
  { department: 'sales', route: '/sales/mcsp/validity-requests', label: 'Validity Requests' },
  { department: 'sales', route: '/sales/mcsp/shift-requests', label: 'Shift Requests' },
  { department: 'sales', route: '/sales/mcsp/recalls', label: 'Recalls' },
]

/** Every SUB_MODULES level whose route is a prefix of `pathname`, from
 * least to most specific — the full breadcrumb trail below the department. */
export function getBreadcrumbTrail(pathname: string): SubModule[] {
  return SUB_MODULES.filter((m) => pathname === m.route || pathname.startsWith(`${m.route}/`)).sort(
    (a, b) => a.route.length - b.route.length,
  )
}
