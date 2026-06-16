import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, requireRole }) => {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ea-primary"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Block pending/rejected users even if they have a valid session
  if (userProfile && userProfile.status !== 'active') {
    return <Navigate to="/login" replace />
  }

  if (requireRole && userProfile?.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
