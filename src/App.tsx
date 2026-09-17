import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireDepartment from './components/RequireDepartment'
import RequireAdmin from './components/RequireAdmin'
import RequireCoreManagementAdmin from './components/RequireCoreManagementAdmin'
import RequireStaffTaskAccess from './components/RequireStaffTaskAccess'
import Layout from './components/Layout'
import CoreManagementShell from './components/CoreManagementShell'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import DepartmentPlaceholder from './pages/DepartmentPlaceholder'
import AdminModule from './pages/admin/AdminModule'
import PurchaseModule from './pages/purchase/PurchaseModule'
import YaamyaModule from './pages/yaamya/YaamyaModule'
import SalesModule from './pages/sales/SalesModule'
import ActiveTasks from './pages/coreManagement/ActiveTasks'
import AllTasks from './pages/coreManagement/AllTasks'
import DelayedTasks from './pages/coreManagement/DelayedTasks'
import DeletedTasks from './pages/coreManagement/DeletedTasks'
import TodayPoints from './pages/coreManagement/TodayPoints'
import Meetings from './pages/coreManagement/Meetings'
import ScratchSheet from './pages/coreManagement/ScratchSheet'
import StaffMyTasks from './pages/coreManagement/StaffMyTasks'
import { DEPARTMENTS } from './config/departments'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Welcome />} />

            {DEPARTMENTS.map((dept) =>
              dept.key === 'admin' ? (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireAdmin>
                      <AdminModule />
                    </RequireAdmin>
                  }
                />
              ) : dept.key === 'purchase' ? (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireDepartment deptKey={dept.key}>
                      <PurchaseModule />
                    </RequireDepartment>
                  }
                />
              ) : dept.key === 'yaamya' ? (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireDepartment deptKey={dept.key}>
                      <YaamyaModule />
                    </RequireDepartment>
                  }
                />
              ) : dept.key === 'sales' ? (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireDepartment deptKey={dept.key}>
                      <SalesModule />
                    </RequireDepartment>
                  }
                />
              ) : (
                <Route
                  key={dept.key}
                  path={dept.route}
                  element={
                    <RequireDepartment deptKey={dept.key}>
                      <DepartmentPlaceholder department={dept} />
                    </RequireDepartment>
                  }
                />
              ),
            )}
          </Route>

          {/* Core Management — deliberately outside the department switcher and
              the RequireAuth><Layout> block above, so it never renders the
              global department Sidebar. Restricted to exactly two admins,
              enforced here and in RLS on every core_management.* table. */}
          <Route
            path="/core-management/*"
            element={
              <RequireAuth>
                <RequireCoreManagementAdmin>
                  <CoreManagementShell />
                </RequireCoreManagementAdmin>
              </RequireAuth>
            }
          >
            <Route index element={<ActiveTasks />} />
            <Route path="all" element={<AllTasks />} />
            <Route path="delayed" element={<DelayedTasks />} />
            <Route path="deleted" element={<DeletedTasks />} />
            <Route path="points" element={<TodayPoints />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="scratch" element={<ScratchSheet />} />
          </Route>

          {/* Staff input surface — separate from Core Management entirely, not
              a locked-down corner of it. Any authenticated user can see this
              route; RLS scopes the data to their own tasks. */}
          <Route
            path="/my-tasks"
            element={
              <RequireAuth>
                <RequireStaffTaskAccess>
                  <StaffMyTasks />
                </RequireStaffTaskAccess>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
