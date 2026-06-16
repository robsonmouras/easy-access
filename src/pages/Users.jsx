import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Modal from '../components/Modal'
import {
  Users as UsersIcon, Clock, UserPlus, CheckCircle, XCircle,
  User, Shield, AlertCircle, Save, X, Lock, Settings2,
  ChevronDown, ChevronRight, Building2, Key,
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
  const { companies } = useCompany()
  const isSuperAdmin = userProfile?.role === 'super_admin'
  const isAdmin      = userProfile?.role === 'admin'
  const canAccess    = isSuperAdmin || isAdmin

  const [tab, setTab]           = useState(isSuperAdmin ? 'todos' : 'pendentes')
  const [allUsers, setAllUsers] = useState([])
  const [pending, setPending]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [processing, setProcessing] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Role editing (inline na tabela)
  const [editingUser, setEditingUser] = useState(null)
  const [newRole, setNewRole]         = useState('')

  // ─── Invite modal ────────────────────────────────────────────────────────────
  const [showInvite, setShowInvite]         = useState(false)
  const [inviteForm, setInviteForm]         = useState({ email: '', fullName: '', role: 'básico' })
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [inviteError, setInviteError]       = useState('')
  const [inviteSuccess, setInviteSuccess]   = useState('')
  // Custom access no convite
  const [inviteCustomAccess, setInviteCustomAccess]           = useState(false)
  const [inviteSelectedCompanies, setInviteSelectedCompanies] = useState(new Set())
  const [inviteExceptedCreds, setInviteExceptedCreds]         = useState(new Set())
  const [inviteCredsByCompany, setInviteCredsByCompany]       = useState({})

  // ─── Edit access modal ───────────────────────────────────────────────────────
  const [editAccessUser, setEditAccessUser]           = useState(null)
  const [editCustomAccess, setEditCustomAccess]       = useState(false)
  const [editSelectedCompanies, setEditSelectedCompanies] = useState(new Set())
  const [editExceptedCreds, setEditExceptedCreds]     = useState(new Set())
  const [editCredsByCompany, setEditCredsByCompany]   = useState({})
  const [editAccessLoading, setEditAccessLoading]     = useState(false)
  const [editAccessSaving, setEditAccessSaving]       = useState(false)

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

  // ─── Helpers de credenciais on-demand ────────────────────────────────────────
  const loadCredentialsForCompany = async (companyId, credsByCompany, setCredsByCompany) => {
    if (credsByCompany[companyId] !== undefined) return
    const { data } = await supabase
      .from('credentials')
      .select('id, name, type')
      .eq('company_id', companyId)
      .order('name')
    setCredsByCompany(prev => ({ ...prev, [companyId]: data || [] }))
  }

  // ─── Regra de permissão: quem pode editar o escopo de quem ──────────────────
  const canManageAccess = (targetUser) => {
    if (isSuperAdmin) return true
    if (isAdmin && targetUser.role === 'básico' && targetUser.invited_by_id === userProfile?.id) return true
    return false
  }

  // ─── Aprovação / rejeição ────────────────────────────────────────────────────
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

  // ─── Edição de papel (inline) ────────────────────────────────────────────────
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

  // ─── Convite ─────────────────────────────────────────────────────────────────
  const resetInviteState = () => {
    setInviteForm({ email: '', fullName: '', role: 'básico' })
    setInviteCustomAccess(false)
    setInviteSelectedCompanies(new Set())
    setInviteExceptedCreds(new Set())
    setInviteCredsByCompany({})
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

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: authData.user.id,
          email: inviteForm.email,
          full_name: inviteForm.fullName,
          role: inviteForm.role,
          status: 'pending',
          invited_by_id: userProfile?.id || null,
          invited_by_name: userProfile?.full_name || null,
          custom_access_enabled: inviteCustomAccess,
        }])
      if (profileError) throw profileError

      // Salva acesso personalizado se habilitado
      if (inviteCustomAccess && inviteSelectedCompanies.size > 0) {
        const companyRows = Array.from(inviteSelectedCompanies).map(companyId => ({
          user_id: authData.user.id,
          company_id: companyId,
          granted_by: userProfile?.id || null,
        }))
        const { error: accessErr } = await supabase.from('user_company_access').insert(companyRows)
        if (accessErr) throw accessErr

        if (inviteExceptedCreds.size > 0) {
          const exceptRows = Array.from(inviteExceptedCreds).map(credId => ({
            user_id: authData.user.id,
            credential_id: credId,
            created_by: userProfile?.id || null,
          }))
          const { error: exceptErr } = await supabase.from('user_credential_exceptions').insert(exceptRows)
          if (exceptErr) throw exceptErr
        }
      }

      setInviteSuccess(`${inviteForm.email} convidado com sucesso! Aguardando aprovação de um Super Admin.`)
      resetInviteState()
      await fetchData()
    } catch (err) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        setInviteError('Limite de envios atingido. Tente novamente mais tarde.')
      } else {
        setInviteError(msg || 'Erro ao criar usuário')
      }
    } finally {
      setInviteLoading(false)
    }
  }

  // ─── Edição de acesso personalizado ─────────────────────────────────────────
  const openEditAccess = async (targetUser) => {
    setEditAccessUser(targetUser)
    setEditCustomAccess(targetUser.custom_access_enabled || false)
    setEditSelectedCompanies(new Set())
    setEditExceptedCreds(new Set())
    setEditCredsByCompany({})
    setEditAccessLoading(true)

    try {
      const [{ data: companyAccess, error: err1 }, { data: credExceptions, error: err2 }] =
        await Promise.all([
          supabase.from('user_company_access').select('company_id').eq('user_id', targetUser.id),
          supabase.from('user_credential_exceptions').select('credential_id').eq('user_id', targetUser.id),
        ])
      if (err1) throw err1
      if (err2) throw err2

      const selectedIds = new Set(companyAccess?.map(r => r.company_id) || [])
      const exceptedIds = new Set(credExceptions?.map(r => r.credential_id) || [])
      setEditSelectedCompanies(selectedIds)
      setEditExceptedCreds(exceptedIds)

      // Pré-carrega credenciais das empresas já liberadas
      if (selectedIds.size > 0) {
        const results = await Promise.all(
          Array.from(selectedIds).map(companyId =>
            supabase
              .from('credentials')
              .select('id, name, type')
              .eq('company_id', companyId)
              .order('name')
              .then(({ data }) => [companyId, data || []])
          )
        )
        setEditCredsByCompany(Object.fromEntries(results))
      }
    } catch (err) {
      Swal.fire({ title: 'Erro', text: 'Não foi possível carregar as configurações de acesso.', icon: 'error' })
      setEditAccessUser(null)
    } finally {
      setEditAccessLoading(false)
    }
  }

  const saveEditAccess = async () => {
    if (!editAccessUser) return
    setEditAccessSaving(true)
    try {
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({ custom_access_enabled: editCustomAccess })
        .eq('id', editAccessUser.id)
      if (profileErr) throw profileErr

      // Substitui registros de empresa (delete-all + insert)
      const { error: delCompErr } = await supabase
        .from('user_company_access')
        .delete()
        .eq('user_id', editAccessUser.id)
      if (delCompErr) throw delCompErr

      if (editCustomAccess && editSelectedCompanies.size > 0) {
        const rows = Array.from(editSelectedCompanies).map(companyId => ({
          user_id: editAccessUser.id,
          company_id: companyId,
          granted_by: userProfile?.id || null,
        }))
        const { error } = await supabase.from('user_company_access').insert(rows)
        if (error) throw error
      }

      // Substitui exceções de credencial
      const { error: delCredErr } = await supabase
        .from('user_credential_exceptions')
        .delete()
        .eq('user_id', editAccessUser.id)
      if (delCredErr) throw delCredErr

      if (editCustomAccess && editExceptedCreds.size > 0) {
        const rows = Array.from(editExceptedCreds).map(credId => ({
          user_id: editAccessUser.id,
          credential_id: credId,
          created_by: userProfile?.id || null,
        }))
        const { error } = await supabase.from('user_credential_exceptions').insert(rows)
        if (error) throw error
      }

      await fetchData()
      setEditAccessUser(null)
      Swal.fire({ title: 'Acessos salvos!', icon: 'success', timer: 2000, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message || 'Erro ao salvar acessos', icon: 'error' })
    } finally {
      setEditAccessSaving(false)
    }
  }

  const availableRoles = isSuperAdmin
    ? [{ value: 'básico', label: 'Básico' }, { value: 'admin', label: 'Admin' }]
    : [{ value: 'básico', label: 'Básico' }]

  // Toggle de personalização visível quando o papel convidado pode ter acesso personalizado
  const canCustomizeInviteAccess = inviteForm.role !== 'super_admin'

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
          {/* Cabeçalho */}
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

          {/* Abas */}
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

          {/* Conteúdo */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ea-primary" />
            </div>
          ) : tab === 'todos' ? (
            <AllUsersTab
              users={allUsers}
              currentUserId={userProfile?.id}
              editingUser={editingUser}
              newRole={newRole}
              onEditRole={(u) => { setEditingUser(u); setNewRole(u.role) }}
              onSaveRole={handleSaveRole}
              onCancelEdit={() => { setEditingUser(null); setNewRole('') }}
              onRoleChange={setNewRole}
              onEditAccess={openEditAccess}
              canManageAccess={canManageAccess}
              isSuperAdmin={isSuperAdmin}
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

      {/* ─── Modal: Convidar Usuário ─────────────────────────────────────────── */}
      <Modal
        isOpen={showInvite}
        onClose={() => { setShowInvite(false); resetInviteState(); setInviteError(''); setInviteSuccess('') }}
        title="Convidar Novo Usuário"
      >
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
              onChange={(e) => {
                setInviteForm({ ...inviteForm, role: e.target.value })
                if (e.target.value === 'super_admin') setInviteCustomAccess(false)
              }}
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

          {/* Toggle de personalização de acesso */}
          {canCustomizeInviteAccess && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setInviteCustomAccess(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-ea-primary" />
                  <span className="text-sm font-medium text-gray-700">Personalizar acessos</span>
                  <span className="text-xs text-gray-500">— restringe o que esse usuário visualiza</span>
                </div>
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  inviteCustomAccess ? 'bg-ea-accent' : 'bg-gray-300'
                }`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                    inviteCustomAccess ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
              </button>

              {inviteCustomAccess && (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-3">
                    Selecione as empresas que este usuário poderá visualizar. Dentro de cada empresa, todas as credenciais são visíveis por padrão — expanda para ocultar credenciais específicas.
                  </p>
                  <CustomAccessPanel
                    companies={companies}
                    selectedCompanyIds={inviteSelectedCompanies}
                    exceptedCredentialIds={inviteExceptedCreds}
                    credsByCompany={inviteCredsByCompany}
                    onCompanyToggle={(id, checked) => {
                      setInviteSelectedCompanies(prev => {
                        const next = new Set(prev)
                        if (checked) {
                          next.add(id)
                        } else {
                          next.delete(id)
                          // Remove exceções de credenciais desta empresa
                          if (inviteCredsByCompany[id]) {
                            const credIds = new Set(inviteCredsByCompany[id].map(c => c.id))
                            setInviteExceptedCreds(prev2 => {
                              const n = new Set(prev2)
                              credIds.forEach(cid => n.delete(cid))
                              return n
                            })
                          }
                        }
                        return next
                      })
                    }}
                    onCredentialToggle={(credId, visible) => {
                      setInviteExceptedCreds(prev => {
                        const next = new Set(prev)
                        if (visible) { next.delete(credId) } else { next.add(credId) }
                        return next
                      })
                    }}
                    onNeedCredentials={(companyId) =>
                      loadCredentialsForCompany(companyId, inviteCredsByCompany, setInviteCredsByCompany)
                    }
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowInvite(false); resetInviteState(); setInviteError(''); setInviteSuccess('') }}
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

      {/* ─── Modal: Editar Acesso Personalizado ──────────────────────────────── */}
      <Modal
        isOpen={!!editAccessUser}
        onClose={() => setEditAccessUser(null)}
        title={`Acessos — ${editAccessUser?.full_name || ''}`}
      >
        {editAccessLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ea-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setEditCustomAccess(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-ea-primary" />
                <span className="text-sm font-medium text-gray-700">Acesso personalizado</span>
              </div>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                editCustomAccess ? 'bg-ea-accent' : 'bg-gray-300'
              }`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  editCustomAccess ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </div>
            </button>

            {editCustomAccess ? (
              <>
                <p className="text-xs text-gray-500">
                  Selecione as empresas e credenciais que este usuário poderá visualizar. Desligar o acesso personalizado libera tudo que o papel permite.
                </p>
                <CustomAccessPanel
                  companies={companies}
                  selectedCompanyIds={editSelectedCompanies}
                  exceptedCredentialIds={editExceptedCreds}
                  credsByCompany={editCredsByCompany}
                  onCompanyToggle={(id, checked) => {
                    setEditSelectedCompanies(prev => {
                      const next = new Set(prev)
                      if (checked) {
                        next.add(id)
                      } else {
                        next.delete(id)
                        if (editCredsByCompany[id]) {
                          const credIds = new Set(editCredsByCompany[id].map(c => c.id))
                          setEditExceptedCreds(prev2 => {
                            const n = new Set(prev2)
                            credIds.forEach(cid => n.delete(cid))
                            return n
                          })
                        }
                      }
                      return next
                    })
                  }}
                  onCredentialToggle={(credId, visible) => {
                    setEditExceptedCreds(prev => {
                      const next = new Set(prev)
                      if (visible) { next.delete(credId) } else { next.add(credId) }
                      return next
                    })
                  }}
                  onNeedCredentials={(companyId) =>
                    loadCredentialsForCompany(companyId, editCredsByCompany, setEditCredsByCompany)
                  }
                />
              </>
            ) : (
              <p className="text-sm text-gray-500 py-2">
                Com o acesso personalizado desligado, este usuário visualizará todas as empresas e credenciais permitidas pelo seu papel.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditAccessUser(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditAccess}
                disabled={editAccessSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editAccessSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Panel de seleção de empresas e credenciais ────────────────────────────────

function CustomAccessPanel({
  companies,
  selectedCompanyIds,
  exceptedCredentialIds,
  credsByCompany,
  onCompanyToggle,
  onCredentialToggle,
  onNeedCredentials,
}) {
  const [expanded, setExpanded] = useState(new Set())

  const handleCompanyCheck = (companyId, checked) => {
    onCompanyToggle(companyId, checked)
    if (checked) {
      setExpanded(prev => new Set([...prev, companyId]))
      onNeedCredentials(companyId)
    } else {
      setExpanded(prev => { const n = new Set(prev); n.delete(companyId); return n })
    }
  }

  const toggleExpand = (companyId) => {
    if (!selectedCompanyIds.has(companyId)) return
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(companyId)) {
        n.delete(companyId)
      } else {
        n.add(companyId)
        onNeedCredentials(companyId)
      }
      return n
    })
  }

  if (companies.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">Nenhuma empresa cadastrada.</p>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-72 overflow-y-auto">
      {companies.map(company => {
        const isSelected = selectedCompanyIds.has(company.id)
        const isExpanded = expanded.has(company.id)
        const creds = credsByCompany[company.id]

        return (
          <div key={company.id}>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50">
              <input
                type="checkbox"
                id={`ca-co-${company.id}`}
                checked={isSelected}
                onChange={(e) => handleCompanyCheck(company.id, e.target.checked)}
                className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
              />
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <label
                htmlFor={`ca-co-${company.id}`}
                className="flex-1 text-sm font-medium text-gray-800 cursor-pointer"
              >
                {company.name}
              </label>
              {isSelected && (
                <button
                  type="button"
                  onClick={() => toggleExpand(company.id)}
                  className="flex items-center gap-1 text-xs text-ea-primary hover:underline flex-shrink-0"
                >
                  {isExpanded
                    ? <><ChevronDown className="w-3 h-3" /> Ocultar</>
                    : <><ChevronRight className="w-3 h-3" /> Credenciais</>
                  }
                </button>
              )}
            </div>

            {isSelected && isExpanded && (
              <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 pl-10 space-y-1.5">
                {creds === undefined ? (
                  <p className="text-xs text-gray-400 py-1">Carregando...</p>
                ) : creds.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">Nenhuma credencial nesta empresa.</p>
                ) : (
                  creds.map(cred => {
                    const isVisible = !exceptedCredentialIds.has(cred.id)
                    return (
                      <div key={cred.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`ca-cr-${cred.id}`}
                          checked={isVisible}
                          onChange={(e) => onCredentialToggle(cred.id, e.target.checked)}
                          className="w-3.5 h-3.5 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                        />
                        <Key className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <label htmlFor={`ca-cr-${cred.id}`} className="text-xs text-gray-700 cursor-pointer">
                          <span className="font-medium">{cred.name}</span>
                          <span className="text-gray-400 ml-1">· {cred.type}</span>
                        </label>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AllUsersTab({
  users, currentUserId, editingUser, newRole,
  onEditRole, onSaveRole, onCancelEdit, onRoleChange,
  onEditAccess, canManageAccess, isSuperAdmin,
}) {
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
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-ea-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      {u.custom_access_enabled && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">
                          <Lock className="w-3 h-3" /> Acesso restrito
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                <td className="py-3 px-4">
                  {editingUser?.id === u.id ? (
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
                      <button onClick={onSaveRole} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Salvar">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancelar">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[u.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_CONFIG[u.status]?.label || u.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Editar papel (apenas super_admin e para outros usuários) */}
                    {isSuperAdmin && u.id !== currentUserId && editingUser?.id !== u.id && (
                      <button
                        onClick={() => onEditRole(u)}
                        className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                        title="Editar papel"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    {/* Personalizar acessos */}
                    {canManageAccess(u) && u.id !== currentUserId && editingUser?.id !== u.id && (
                      <button
                        onClick={() => onEditAccess(u)}
                        className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                        title="Personalizar acessos"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {users.map((u) => (
          <div key={u.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-ea-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{u.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[u.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_CONFIG[u.status]?.label || u.status}
                    </span>
                    {u.custom_access_enabled && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> Restrito
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isSuperAdmin && u.id !== currentUserId && editingUser?.id !== u.id && (
                  <button onClick={() => onEditRole(u)} className="p-1.5 text-ea-primary hover:bg-ea-surface rounded">
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                {canManageAccess(u) && u.id !== currentUserId && editingUser?.id !== u.id && (
                  <button onClick={() => onEditAccess(u)} className="p-1.5 text-ea-primary hover:bg-ea-surface rounded">
                    <Settings2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {editingUser?.id === u.id && (
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
                        Convidado por <span className="font-medium text-gray-700">{u.invited_by_name}</span>
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
