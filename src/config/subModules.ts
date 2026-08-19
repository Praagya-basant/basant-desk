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
]

export function getSubModule(pathname: string): SubModule | undefined {
  return SUB_MODULES.find((m) => pathname === m.route || pathname.startsWith(`${m.route}/`))
}
