import { Routes, Route } from 'react-router-dom'
import RequireAdminOrDeptAdmin from '../../components/RequireAdminOrDeptAdmin'
import YaamyaHome from './YaamyaHome'
import WoodInward from './WoodInward'
import InwardLog from './InwardLog'

export default function YaamyaModule() {
  return (
    <Routes>
      <Route index element={<YaamyaHome />} />
      {/* Any Yaamya member can log pieces (RequireDepartment gate is applied
          one level up, in App.tsx). */}
      <Route path="wood-inward" element={<WoodInward />} />
      {/* The full history / correction surface is a manager view. */}
      <Route
        path="inward-log"
        element={
          <RequireAdminOrDeptAdmin departmentKey="yaamya">
            <InwardLog />
          </RequireAdminOrDeptAdmin>
        }
      />
    </Routes>
  )
}
