import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireDepartment from './components/RequireDepartment'
import RequireAdmin from './components/RequireAdmin'
import Layout from './components/Layout'
import Login from './pages/Login'
import Welcome from './pages/Welcome'
import DepartmentPlaceholder from './pages/DepartmentPlaceholder'
import AdminUsers from './pages/admin/Users'
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
                  path={dept.route}
                  element={
                    <RequireAdmin>
                      <AdminUsers />
                    </RequireAdmin>
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
