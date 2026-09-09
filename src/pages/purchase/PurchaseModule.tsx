import { Routes, Route } from 'react-router-dom'
import RequireModule from '../../components/RequireModule'
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
      {/* Marble Costing is a stub with no data — gated only by department entry.
          When it's built, wrap it in <RequireModule moduleKey="purchase.marble" min="view">. */}
      <Route path="marble-costing" element={<MarbleCosting />} />
      <Route
        path="users"
        element={
          <RequireModule moduleKey="purchase.users" min="admin">
            <PurchaseUsers />
          </RequireModule>
        }
      />

      <Route path="honeycomb" element={<HoneycombHome />} />
      <Route
        path="honeycomb/extraction"
        element={
          <RequireModule moduleKey="purchase.honeycomb" min="edit">
            <HCExtraction />
          </RequireModule>
        }
      />
      <Route
        path="honeycomb/history"
        element={
          <RequireModule moduleKey="purchase.honeycomb_history" min="view">
            <HCExtractionHistory />
          </RequireModule>
        }
      />
      <Route
        path="honeycomb/history/:id"
        element={
          <RequireModule moduleKey="purchase.honeycomb_history" min="view">
            <HCExtractionDetail />
          </RequireModule>
        }
      />
      <Route
        path="honeycomb/price-grid"
        element={
          <RequireModule moduleKey="purchase.honeycomb_price_grid" min="admin">
            <PriceGridSettings />
          </RequireModule>
        }
      />
    </Routes>
  )
}
