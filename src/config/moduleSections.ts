import type { AccessRule } from '../lib/access'

// Grouped sidebar/tab items for a department's shell. Each department that has
// sub-modules registers its own sections here; departments with none (e.g. the
// placeholder departments) simply have no entry and render with just the
// switcher + logo.
export interface ModuleItem {
  key: string
  label: string
  route: string
  access: AccessRule
}

export interface ModuleSection {
  key: string
  label: string
  items: ModuleItem[]
}

export interface DepartmentModules {
  department: string
  sections: ModuleSection[]
}

export const MODULE_SECTIONS: DepartmentModules[] = [
  {
    department: 'purchase',
    sections: [
      {
        key: 'costing-tools',
        label: 'Costing Tools',
        items: [
          {
            key: 'honeycomb',
            label: 'Honeycomb Calculator',
            route: '/purchase/honeycomb',
            access: { type: 'permission', key: 'purchase.hc_extraction' },
          },
          {
            key: 'marble-costing',
            label: 'Marble Costing',
            route: '/purchase/marble-costing',
            access: { type: 'public' },
          },
        ],
      },
      {
        key: 'admin',
        label: 'Admin',
        items: [
          {
            key: 'price-grid',
            label: 'Price Grid',
            route: '/purchase/honeycomb/price-grid',
            access: { type: 'adminOrDeptAdmin', departmentKey: 'purchase' },
          },
          {
            key: 'users',
            label: 'Users',
            route: '/purchase/users',
            access: { type: 'adminOrDeptAdmin', departmentKey: 'purchase' },
          },
          {
            key: 'history',
            label: 'History',
            route: '/purchase/honeycomb/history',
            access: { type: 'permission', key: 'purchase.hc_extraction' },
          },
        ],
      },
    ],
  },
  {
    department: 'admin',
    sections: [
      {
        key: 'admin',
        label: 'Admin',
        items: [
          { key: 'users', label: 'Users', route: '/admin', access: { type: 'public' } },
          { key: 'access', label: 'Manage Access', route: '/admin/access', access: { type: 'public' } },
        ],
      },
    ],
  },
]

export function getModuleSections(departmentKey: string): DepartmentModules | undefined {
  return MODULE_SECTIONS.find((d) => d.department === departmentKey)
}
