import { Routes, Route } from 'react-router-dom'
import RequireAdminOrDeptAdmin from '../../components/RequireAdminOrDeptAdmin'
import McspHome from './McspHome'
import Samples from './Samples'
import Movements from './Movements'
import Buyers from './Buyers'
import Halls from './Halls'
import McspUsers from './McspUsers'

export default function McspModule() {
  return (
    <Routes>
      <Route index element={<McspHome />} />
      {/* Any MCSP member can view/issue/return samples and view movements —
          RLS scopes what they actually see (own hall / own buyers). */}
      <Route path="samples" element={<Samples />} />
      <Route path="movements" element={<Movements />} />

      {/* Admin surfaces — MCSP department admin or global admin only. */}
      <Route
        path="buyers"
        element={
          <RequireAdminOrDeptAdmin departmentKey="mcsp">
            <Buyers />
          </RequireAdminOrDeptAdmin>
        }
      />
      <Route
        path="halls"
        element={
          <RequireAdminOrDeptAdmin departmentKey="mcsp">
            <Halls />
          </RequireAdminOrDeptAdmin>
        }
      />
      <Route
        path="users"
        element={
          <RequireAdminOrDeptAdmin departmentKey="mcsp">
            <McspUsers />
          </RequireAdminOrDeptAdmin>
        }
      />
    </Routes>
  )
}
