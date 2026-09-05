import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import Samples from './Samples'
import Movements from './Movements'

export default function McsArea() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="samples" element={<Samples />} />
      <Route path="movements" element={<Movements />} />
    </Routes>
  )
}
