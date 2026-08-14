import type { LucideIcon } from 'lucide-react'
import {
  ShoppingCart,
  Boxes,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Users,
  Factory,
} from 'lucide-react'

export interface Department {
  key: string
  label: string
  route: string
  icon: LucideIcon
}

export const DEPARTMENTS: Department[] = [
  { key: 'purchase', label: 'Purchase', route: '/purchase', icon: ShoppingCart },
  { key: 'mcsp', label: 'MCSP', route: '/mcsp', icon: Boxes },
  { key: 'sales', label: 'Sales', route: '/sales', icon: TrendingUp },
  { key: 'newness', label: 'Newness Tracker', route: '/newness', icon: Sparkles },
  { key: 'quality', label: 'Quality Inspection', route: '/quality', icon: ShieldCheck },
  { key: 'hr', label: 'HR', route: '/hr', icon: Users },
  { key: 'yaamya', label: 'Yaamya Unit', route: '/yaamya', icon: Factory },
]

export function getDepartment(key: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.key === key)
}
