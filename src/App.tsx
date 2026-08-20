import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireDepartment from './components/RequireDepartment'
import RequireAdmin from './components/RequireAdmin'
import DepartmentShell from './components/DepartmentShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DepartmentPlaceholder from './pages/DepartmentPlaceholder'
import { adminRouteTable } from './pages/admin/adminRoutes'
import { purchaseRouteTable } from './pages/purchase/purchaseRoutes'
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
                <Outlet />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />

            {DEPARTMENTS.map((dept) =>
              dept.key === 'admin' ? (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireAdmin>
                      <DepartmentShell departmentKey="admin" routeTable={adminRouteTable} />
                    </RequireAdmin>
                  }
                />
              ) : (
                <Route
                  key={dept.key}
                  path={`${dept.route}/*`}
                  element={
                    <RequireDepartment deptKey={dept.key}>
                      <DepartmentShell
                        departmentKey={dept.key}
                        routeTable={
                          dept.key === 'purchase'
                            ? purchaseRouteTable
                            : [{ path: '', element: <DepartmentPlaceholder department={dept} /> }]
                        }
                      />
                    </RequireDepartment>
                  }
                />
              ),
            )}
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
