import { Routes, Route } from 'react-router-dom'
import RequireAdmin from '../../components/RequireAdmin'
import RequirePermission from '../../components/RequirePermission'
import PurchaseHome from './PurchaseHome'
import HCExtraction from './HCExtraction'
import HCExtractionHistory from './HCExtractionHistory'
import HCExtractionDetail from './HCExtractionDetail'
import PriceGridSettings from './PriceGridSettings'

export default function PurchaseModule() {
  return (
    <Routes>
      <Route index element={<PurchaseHome />} />
      <Route
        path="hc-extraction"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtraction />
          </RequirePermission>
        }
      />
      <Route
        path="hc-extraction/history"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtractionHistory />
          </RequirePermission>
        }
      />
      <Route
        path="hc-extraction/history/:id"
        element={
          <RequirePermission permissionKey="purchase.hc_extraction">
            <HCExtractionDetail />
          </RequirePermission>
        }
      />
      <Route
        path="settings/price-grid"
        element={
          <RequireAdmin>
            <PriceGridSettings />
          </RequireAdmin>
        }
      />
    </Routes>
  )
}
