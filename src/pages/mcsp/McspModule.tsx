import { useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import RequireAdminOrDeptAdmin from '../../components/RequireAdminOrDeptAdmin'
import McsArea from './mcs/McsArea'
import McpArea from './mcp/McpArea'
import Buyers from './Buyers'
import Halls from './Halls'
import McspUsers from './McspUsers'
import ValidityRequestsQueue from './ValidityRequestsQueue'
import ShiftRequestsQueue from './ShiftRequestsQueue'
import RecallsQueue from './RecallsQueue'
import RequireMcspReviewAccess from './RequireMcspReviewAccess'
import McspNotificationBell from './McspNotificationBell'

// MCSP now lives under Sales (department key 'sales') — mounted by
// SalesModule at /sales/mcsp/*. Its nav is the single global Sidebar's
// contextual content (McspNav) — no nested sidebar is rendered here.
export default function McspModule() {
  const location = useLocation()
  const isMcp = location.pathname.includes('/sales/mcsp/mcp')
  const isMcs = location.pathname.includes('/sales/mcsp/mcs')

  // MCS and MCP each stay mounted once visited, so switching the pill in the
  // sidebar just toggles visibility (CSS) instead of unmounting/refetching —
  // no "reload" flash, no lost scroll/filter state. Each keeps its own frozen
  // `location` while the other area is active, so its <Routes> doesn't try to
  // match the live (other-area) URL and unmount itself.
  const mcsLocation = useRef(location)
  const mcpLocation = useRef(location)
  if (isMcs) mcsLocation.current = location
  if (isMcp) mcpLocation.current = location

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-end mb-2">
        <McspNotificationBell />
      </div>

      <div hidden={!isMcs}>
        <Routes location={mcsLocation.current}>
          <Route path="mcs/*" element={<McsArea />} />
        </Routes>
      </div>
      <div hidden={!isMcp}>
        <Routes location={mcpLocation.current}>
          <Route path="mcp/*" element={<McpArea />} />
        </Routes>
      </div>

      <Routes>
        <Route index element={<Navigate to="mcs" replace />} />
        <Route
          path="buyers"
          element={
            <RequireAdminOrDeptAdmin departmentKey="sales">
              <Buyers />
            </RequireAdminOrDeptAdmin>
          }
        />
        <Route
          path="halls"
          element={
            <RequireAdminOrDeptAdmin departmentKey="sales">
              <Halls />
            </RequireAdminOrDeptAdmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireAdminOrDeptAdmin departmentKey="sales">
              <McspUsers />
            </RequireAdminOrDeptAdmin>
          }
        />
        <Route
          path="validity-requests"
          element={
            <RequireMcspReviewAccess>
              <ValidityRequestsQueue />
            </RequireMcspReviewAccess>
          }
        />
        <Route
          path="shift-requests"
          element={
            <RequireMcspReviewAccess>
              <ShiftRequestsQueue />
            </RequireMcspReviewAccess>
          }
        />
        <Route
          path="recalls"
          element={
            <RequireAdminOrDeptAdmin departmentKey="sales">
              <RecallsQueue />
            </RequireAdminOrDeptAdmin>
          }
        />
      </Routes>
    </div>
  )
}
