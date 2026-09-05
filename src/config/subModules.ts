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
  { department: 'mcsp', route: '/mcsp/samples', label: 'Samples' },
  { department: 'mcsp', route: '/mcsp/movements', label: 'Movements' },
  { department: 'mcsp', route: '/mcsp/buyers', label: 'Buyers' },
  { department: 'mcsp', route: '/mcsp/halls', label: 'Halls' },
  { department: 'mcsp', route: '/mcsp/users', label: 'Users' },
]

export function getSubModule(pathname: string): SubModule | undefined {
  return SUB_MODULES.find((m) => pathname === m.route || pathname.startsWith(`${m.route}/`))
}
