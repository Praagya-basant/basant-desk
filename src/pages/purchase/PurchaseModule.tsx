import { Routes, Route } from 'react-router-dom'
import RequireAdmin from '../../components/RequireAdmin'
import PurchaseHome from './PurchaseHome'
import HCExtraction from './HCExtraction'
import HCExtractionHistory from './HCExtractionHistory'
import HCExtractionDetail from './HCExtractionDetail'
import PriceGridSettings from './PriceGridSettings'

export default function PurchaseModule() {
  return (
    <Routes>
      <Route index element={<PurchaseHome />} />
      <Route path="hc-extraction" element={<HCExtraction />} />
      <Route path="hc-extraction/history" element={<HCExtractionHistory />} />
      <Route path="hc-extraction/history/:id" element={<HCExtractionDetail />} />
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
