import { Routes, Route, Navigate } from 'react-router-dom'
import AIEngineeringPage from '../src/pages/AIEngineeringPage'
import EvalDashboardPage from '../src/pages/EvalDashboardPage'
import MyEventsPage from '../src/pages/MyEventsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ai-engineering" replace />} />
      <Route path="/ai-engineering" element={<AIEngineeringPage />} />
      <Route path="/ai-engineering/eval" element={<EvalDashboardPage />} />
      <Route path="/ai-engineering/my-events" element={<MyEventsPage />} />
    </Routes>
  )
}
