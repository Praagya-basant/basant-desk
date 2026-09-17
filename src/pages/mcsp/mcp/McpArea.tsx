import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Panels from './Panels'
import Movements from './Movements'

export default function McpArea() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="panels" element={<Panels />} />
      <Route path="movements" element={<Movements />} />
    </Routes>
  )
}
