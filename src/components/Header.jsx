import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Menu, User, Users, Home as HomeIcon, Briefcase, Tag } from 'lucide-react'
import V4Logo from './V4Logo'

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const { userProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getRoleLabel = (role, isSuperAdmin) => {
    if (isSuperAdmin) return 'Super Admin'
    return role === 'super_admin' ? 'Super Admin' : 'Usuário'
  }

  const isSuperAdmin = userProfile?.is_super_admin === true || userProfile?.role === 'super_admin'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <V4Logo className="h-8 w-auto" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Ir para Home"
            >
              <HomeIcon className="w-4 h-4" />
              <span className="hidden md:inline">Home</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>{userProfile?.full_name || 'Usuário'}</span>
            <span className="px-2 py-1 bg-ea-surface rounded text-xs">
              {getRoleLabel(userProfile?.role, isSuperAdmin)}
            </span>
          </div>

          {isSuperAdmin && (
            <button
              onClick={() => navigate('/users')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Gerenciar usuários"
            >
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Usuários</span>
            </button>
          )}

          {isSuperAdmin && (
            <>
              <button
                onClick={() => navigate('/cargos')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Gerenciar cargos"
              >
                <Briefcase className="w-4 h-4" />
                <span className="hidden md:inline">Cargos</span>
              </button>
              <button
                onClick={() => navigate('/tipos-credencial')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Tipos de credencial"
              >
                <Tag className="w-4 h-4" />
                <span className="hidden md:inline">Tipos</span>
              </button>
            </>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>

      </div>
    </header>
  )
}

export default Header

