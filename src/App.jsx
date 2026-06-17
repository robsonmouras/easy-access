import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') || ''
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import SetPassword from './pages/SetPassword'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import UserApproval from './pages/UserApproval'
import Users from './pages/Users'
import Cargos from './pages/Cargos'
import TiposCredencial from './pages/TiposCredencial'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Router basename={BASE}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invite-user"
              element={<Navigate to="/users" replace />}
            />
            <Route
              path="/user-approval"
              element={
                <ProtectedRoute>
                  <UserApproval />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cargos"
              element={
                <ProtectedRoute>
                  <Cargos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tipos-credencial"
              element={
                <ProtectedRoute>
                  <TiposCredencial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Navigate to="/" replace />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </CompanyProvider>
    </AuthProvider>
  )
}

export default App

