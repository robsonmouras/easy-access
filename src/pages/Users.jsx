import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Modal from '../components/Modal'
import {
  Users as UsersIcon, Clock, UserPlus, CheckCircle, XCircle,
  User, Shield, AlertCircle, Save, X,
} from 'lucide-react'
import Swal from 'sweetalert2'

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', básico: 'Básico' }
const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  básico: 'bg-gray-100 text-gray-700',
}
const STATUS_CONFIG = {
  active:   { label: 'Ativo',     cls: 'bg-green-100 text-green-800' },
  pending:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-800' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800' },
}

export default function Users() {
  const { userProfile, updateUserRole } = useAuth()
  const isSuperAdmin = userProfile?.role === 'super_admin'
  const isAdmin      = userProfile?.role === 'admin'
  const canAccess    = isSuperAdmin || isAdmin

  const [tab, setTab]           = useState(isSuperAdmin ? 'todos' : 'pendentes')
  const [allUsers, setAllUsers] = useState([])
  const [pending, setPending]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [processing, setProcessing] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Role editing
  const [editingUser, setEditingUser] = useState(null)
  const [newRole, setNewRole]         = useState('')

  // Invite modal
  const [showInvite, setShowInvite]     = useState(false)
  const [inviteForm, setInviteForm]     = useState({ email: '', fullName: '', role: 'básico' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    if (canAccess) fetchData()
  }, [canAccess])

  const fetchData = async () => {
    setLoading(true)
    try {
      const pendingQuery = supabase
        .from('user_profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (isSuperAdmin) {
        const [pendingRes, allRes] = await Promise.all([
          pendingQuery,
          supabase.from('user_profiles').select('*').order('full_name'),
        ])
        if (pendingRes.error) throw pendingRes.error
        if (allRes.error)     throw allRes.error
        setPending(pendingRes.data || [])
        setAllUsers(allRes.data   || [])
      } else {
        const { data, error } = await pendingQuery
        if (error) throw error
        setPending(data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (user) => {
    setProcessing(user.id)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: 'active' })
        .eq('id', user.id)
      if (error) throw error
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/set-password`,
      })
      await fetchData()
    } catch (err) {
      Swal.fire({ title: 'Erro', text: 'Erro ao aprovar: ' + err.message, icon: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (userId) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Rejeitar usuário?',
      text: 'O usuário não terá acesso ao sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Rejeitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })
    if (!isConfirmed) return
    setProcessing(userId)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: 'rejected' })
        .eq('id', userId)
      if (error) throw error
      await fetchData()
    } catch (err) {
      Swal.fire({ title: 'Erro', text: 'Erro ao rejeitar: ' + err.message, icon: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  const handleSaveRole = async () => {
    if (!editingUser || !newRole) return
    try {
      await updateUserRole(editingUser.id, newRole)
      await fetchData()
      setEditingUser(null)
      setNewRole('')
    } catch {
      Swal.fire({ title: 'Erro', text: 'Não foi possível atualizar o perfil do usuário.', icon: 'error' })
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    if (!inviteForm.fullName.trim()) {
      setInviteError('O nome completo é obrigatório')
      return
    }
    setInviteLoading(true)
    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', inviteForm.email)
        .maybeSingle()
      if (existing) {
        setInviteError('Este e-mail já está cadastrado no sistema')
        return
      }

      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/set-password`,
          data: { full_name: inviteForm.fullName },
        },
      })
      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          setInviteError('Este e-mail já está cadastrado no sistema')
          return
        }
        throw authError
      }
      if (!authData.user) throw new Error('Erro ao criar usuário')

      const profileBase = {
        id: authData.user.id,
        email: inviteForm.email,
        full_name: inviteForm.fullName,
        role: inviteForm.role,
        status: 'pending',
      }

      // Try saving with invited_by_name; if the column doesn't exist yet fall back without it.
      // To enable this feature, add a nullable text column "invited_by_name" to user_profiles.
      let { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{ ...profileBase, invited_by_name: userProfile?.full_name || null }])

      // PostgREST returns PGRST204 when the column is not in the schema cache;
      // PostgreSQL direct would be 42703. Also match on message as a safety net.
      const isColumnMissing =
        profileError?.code === 'PGRST204' ||
        profileError?.code === '42703' ||
        profileError?.message?.includes('invited_by_name')

      if (isColumnMissing) {
        const { error: retryError } = await supabase.from('user_profiles').insert([profileBase])
        if (retryError) throw retryError
      } else if (profileError) {
        throw profileError
      }

      setInviteSuccess(`${inviteForm.email} convidado com sucesso! Aguardando aprovação de um Super Admin.`)
      setInviteForm({ email: '', fullName: '', role: 'básico' })
      await fetchData()
    } catch (err) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        setInviteError(
          'Erro ao convidar usuario! ' +
          'Tente novamente mais tarde. Se o problema persistir, entre em contato com o suporte.'
        )
      } else {
        setInviteError(msg || 'Erro ao criar usuário')
      }
    } finally {
      setInviteLoading(false)
    }
  }

  const availableRoles = isSuperAdmin
    ? [{ value: 'básico', label: 'Básico' }, { value: 'admin', label: 'Admin' }]
    : [{ value: 'básico', label: 'Básico' }]

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-ea-surface">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas Admins e Super Admins têm acesso a esta área.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ea-surface">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-ea-dark mb-1">Usuários</h1>
              <p className="text-gray-600">Gerencie os acessos ao sistema.</p>
            </div>
            <button
              onClick={() => { setShowInvite(true); setInviteError(''); setInviteSuccess('') }}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Convidar Usuário</span>
              <span className="sm:hidden">Convidar</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-lg shadow-sm border border-ea-border p-1 mb-6 w-fit">
            {isSuperAdmin && (
              <button
                onClick={() => setTab('todos')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === 'todos'
                    ? 'bg-ea-primary text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-ea-surface'
                }`}
              >
                <UsersIcon className="w-4 h-4" />
                Todos
              </button>
            )}
            <button
              onClick={() => setTab('pendentes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'pendentes'
                  ? 'bg-ea-primary text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-ea-surface'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pendentes
              {pending.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  tab === 'pendentes' ? 'bg-white text-ea-primary' : 'bg-ea-accent text-white'
                }`}>
                  {pending.length}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ea-primary" />
            </div>
          ) : tab === 'todos' ? (
            <AllUsersTab
              users={allUsers}
              editingUser={editingUser}
              newRole={newRole}
              onEditRole={(u) => { setEditingUser(u); setNewRole(u.role) }}
              onSaveRole={handleSaveRole}
              onCancelEdit={() => { setEditingUser(null); setNewRole('') }}
              onRoleChange={setNewRole}
            />
          ) : (
            <PendingTab
              pending={pending}
              processing={processing}
              isSuperAdmin={isSuperAdmin}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </div>
      </main>

      {/* Invite Modal */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Convidar Novo Usuário">
        <form onSubmit={handleInvite} className="space-y-4">
          {inviteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{inviteError}</p>
            </div>
          )}
          {inviteSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{inviteSuccess}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value.toLowerCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="usuario@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={inviteForm.fullName}
              onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Nome completo do usuário"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de Acesso *</label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {isAdmin && (
              <p className="mt-1 text-xs text-gray-500">Admins podem convidar apenas usuários Básico.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviteLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteLoading ? 'Criando...' : 'Convidar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AllUsersTab({ users, editingUser, newRole, onEditRole, onSaveRole, onCancelEdit, onRoleChange }) {
  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Nenhum usuário encontrado.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">E-mail</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Perfil</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-ea-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{user.full_name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                <td className="py-3 px-4">
                  {editingUser?.id === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={newRole}
                        onChange={(e) => onRoleChange(e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-ea-primary"
                      >
                        <option value="básico">Básico</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                      <button
                        onClick={onSaveRole}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Salvar"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[user.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_CONFIG[user.status]?.label || user.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {editingUser?.id !== user.id && (
                    <button
                      onClick={() => onEditRole(user)}
                      className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                      title="Editar perfil"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {users.map((user) => (
          <div key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-ea-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[user.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_CONFIG[user.status]?.label || user.status}
                    </span>
                  </div>
                </div>
              </div>
              {editingUser?.id !== user.id && (
                <button
                  onClick={() => onEditRole(user)}
                  className="p-1.5 text-ea-primary hover:bg-ea-surface rounded"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingUser?.id === user.id && (
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={newRole}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-ea-primary"
                >
                  <option value="básico">Básico</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  onClick={onSaveRole}
                  className="px-3 py-1.5 bg-ea-accent text-white text-sm rounded hover:bg-ea-accent-dark"
                >
                  Salvar
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingTab({ pending, processing, isSuperAdmin, onApprove, onReject }) {
  if (pending.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium mb-1">Nenhuma aprovação pendente</p>
        <p className="text-gray-500 text-sm">Todos os usuários foram processados.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50 flex items-center gap-2">
        <Clock className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-800">
          {pending.length} usuário{pending.length !== 1 ? 's' : ''} aguardando aprovação
        </span>
      </div>
      <ul className="divide-y divide-gray-100">
        {pending.map((u) => (
          <li key={u.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-ea-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{u.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {u.invited_by_name ? (
                      <span className="text-xs text-gray-500">
                        Convidado por{' '}
                        <span className="font-medium text-gray-700">{u.invited_by_name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Origem desconhecida</span>
                    )}
                  </div>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onApprove(u)}
                    disabled={processing === u.id}
                    className="flex items-center gap-1.5 bg-ea-accent text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Aprovar</span>
                  </button>
                  <button
                    onClick={() => onReject(u.id)}
                    disabled={processing === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-red-400 text-red-500 font-medium rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Rejeitar</span>
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
