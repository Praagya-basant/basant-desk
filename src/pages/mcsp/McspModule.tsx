import { Routes, Route, Navigate } from 'react-router-dom'
import McspSidebar from './McspSidebar'
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
// SalesModule at /sales/mcsp/*. Own local sidebar (MCS|MCP switcher) sits
// beside the content, inside the platform's normal Layout/breadcrumb shell.
export default function McspModule() {
  return (
    <div className="flex gap-8">
      <McspSidebar />
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-2">
          <McspNotificationBell />
        </div>
        <Routes>
          <Route index element={<Navigate to="mcs" replace />} />
          <Route path="mcs/*" element={<McsArea />} />
          <Route path="mcp/*" element={<McpArea />} />
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
    </div>
  )
}
