import { Routes, Route } from 'react-router-dom'
import SalesHome from './SalesHome'
import McspModule from '../mcsp/McspModule'

export default function SalesModule() {
  return (
    <Routes>
      <Route index element={<SalesHome />} />
      <Route path="mcsp/*" element={<McspModule />} />
    </Routes>
  )
}
