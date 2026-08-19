import { Routes, Route } from 'react-router-dom'
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

export default function PurchaseModule() {
  return (
    <Routes>
      <Route index element={<PurchaseHome />} />
      <Route path="marble-costing" element={<MarbleCosting />} />
      <Route path="users" element={
        <RequireAdminOrDeptAdmin departmentKey="purchase">
          <PurchaseUsers />
        </RequireAdminOrDeptAdmin>
      } />

      <Route path="honeycomb" element={<HoneycombHome />} />
      <Route
        path="honeycomb/extraction"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtraction />
          </RequirePermission>
        }
      />
      <Route
        path="honeycomb/history"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtractionHistory />
          </RequirePermission>
        }
      />
      <Route
        path="honeycomb/history/:id"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtractionDetail />
          </RequirePermission>
        }
      />
      <Route
        path="honeycomb/price-grid"
        element={
          <RequireAdminOrDeptAdmin departmentKey="purchase">
            <PriceGridSettings />
          </RequireAdminOrDeptAdmin>
        }
      />
    </Routes>
  )
}
