import type { LucideIcon } from 'lucide-react'
import { ShoppingCart, Factory, TrendingUp, Users, Boxes, ShieldCheck, Layers } from 'lucide-react'

export interface Department {
  key: string
  label: string
  route: string
  icon: LucideIcon
}

// Mirrors core.departments — keep these keys/routes in sync with that table.
export const DEPARTMENTS: Department[] = [
  { key: 'purchase', label: 'Purchase', route: '/purchase', icon: ShoppingCart },
  { key: 'production', label: 'Production', route: '/production', icon: Factory },
  { key: 'sales', label: 'Sales', route: '/sales', icon: TrendingUp },
  { key: 'hr', label: 'HR', route: '/hr', icon: Users },
  { key: 'yaamya', label: 'Yaamya Industries', route: '/yaamya', icon: Boxes },
  { key: 'mcsp', label: 'MCSP', route: '/mcsp', icon: Layers },
  { key: 'admin', label: 'Admin', route: '/admin', icon: ShieldCheck },
]

export function getDepartment(key: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.key === key)
}
