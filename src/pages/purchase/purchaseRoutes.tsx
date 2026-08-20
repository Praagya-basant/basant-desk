import type { ReactNode } from 'react'
import RequireAdminOrDeptAdmin from '../../components/RequireAdminOrDeptAdmin'
import RequirePermission from '../../components/RequirePermission'
import PurchaseHome from './PurchaseHome'
import HoneycombHome from './HoneycombHome'
import HCExtraction from './HCExtraction'
import HCExtractionHistory from './HCExtractionHistory'
import HCExtractionDetail from './HCExtractionDetail'
import PriceGridSettings from './PriceGridSettings'
import PurchaseUsers from './PurchaseUsers'
import MarbleCosting from './MarbleCosting'

export interface RouteTableEntry {
  path: string
  element: ReactNode
}

// Route table for the Purchase department, mechanically extracted from the
// former PurchaseModule.tsx <Routes> tree so DepartmentShell can mount it
// per open tab. Every path and guard-wrapped element below is unchanged from
// the original — this is a data-shape change only, not a logic change.
export const purchaseRouteTable: RouteTableEntry[] = [
  { path: '', element: <PurchaseHome /> },
  { path: 'marble-costing', element: <MarbleCosting /> },
  {
    path: 'users',
    element: (
      <RequireAdminOrDeptAdmin departmentKey="purchase">
        <PurchaseUsers />
      </RequireAdminOrDeptAdmin>
    ),
  },
  { path: 'honeycomb', element: <HoneycombHome /> },
  {
    path: 'honeycomb/extraction',
    element: (
      <RequirePermission permissionKey="purchase.hc_extraction">
        <HCExtraction />
      </RequirePermission>
    ),
  },
  {
    path: 'honeycomb/history',
    element: (
      <RequirePermission permissionKey="purchase.hc_extraction">
        <HCExtractionHistory />
      </RequirePermission>
    ),
  },
  {
    path: 'honeycomb/history/:id',
    element: (
      <RequirePermission permissionKey="purchase.hc_extraction">
        <HCExtractionDetail />
      </RequirePermission>
    ),
  },
  {
    path: 'honeycomb/price-grid',
    element: (
      <RequireAdminOrDeptAdmin departmentKey="purchase">
        <PriceGridSettings />
      </RequireAdminOrDeptAdmin>
    ),
  },
]
