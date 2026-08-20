import type { RouteTableEntry } from '../purchase/purchaseRoutes'
import AdminUsers from './Users'
import ManageAccess from './ManageAccess'

// Route table for the Admin department, mechanically extracted from the
// former AdminModule.tsx <Routes> tree. The outer RequireAdmin guard (applied
// in App.tsx) already covers this whole subtree, matching today's behavior.
export const adminRouteTable: RouteTableEntry[] = [
  { path: '', element: <AdminUsers /> },
  { path: 'access', element: <ManageAccess /> },
]
