import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { User, Shield, UserCheck, Save, X } from 'lucide-react'
import Modal from './Modal'

const UserManagement = ({ isOpen, onClose }) => {
  const { userProfile, updateUserRole } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [newRole, setNewRole] = useState('')

  useEffect(() => {
    if (isOpen && userProfile?.role === 'super_admin') {
      fetchUsers()
    }
  }, [isOpen, userProfile])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditRole = (user) => {
    setEditingUser(user)
    setNewRole(user.role)
  }

  const handleSaveRole = async () => {
    if (!editingUser || !newRole) return

    try {
      await updateUserRole(editingUser.id, newRole)
      await fetchUsers()
      setEditingUser(null)
      setNewRole('')
    } catch (error) {
      console.error('Erro ao atualizar role:', error)
      alert('Erro ao atualizar role do usuário')
    }
  }

  const getRoleLabel = (role) => {
    const roles = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      básico: 'Básico',
    }
    return roles[role] || role
  }

  const getRoleColor = (role) => {
    const colors = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      básico: 'bg-gray-100 text-gray-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (userProfile?.role !== 'super_admin') {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Usuários">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ea-primary mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Nome</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">E-mail</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Role</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600">{user.email}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleEditRole(user)}
                        className="p-1 text-ea-primary hover:bg-ea-surface rounded"
                        title="Editar role"
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingUser && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">
                Editar Role: {editingUser.full_name}
              </h3>
              <div className="flex items-center gap-3">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                >
                  <option value="básico">Básico</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  onClick={handleSaveRole}
                  className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null)
                    setNewRole('')
                  }}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default UserManagement

