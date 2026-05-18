import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastHost } from './components/Toast'
import { ClientDetail } from './pages/ClientDetail'
import { Clients } from './pages/Clients'
import { Dashboard } from './pages/Dashboard'
import { DealDetail } from './pages/DealDetail'
import { Deals } from './pages/Deals'
import { Login } from './pages/Login'
import { Activities } from './pages/Activities'
import { Reports } from './pages/Reports'
import { Tasks } from './pages/Tasks'
import { Stages } from './pages/Stages'
import { Users } from './pages/Users'

function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/reports" element={<Reports />} />
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/users" element={<Users />} />
              <Route path="/stages" element={<Stages />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
