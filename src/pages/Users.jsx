import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Modal from '../components/Modal'
import {
  Users as UsersIcon, Clock, UserPlus, CheckCircle, XCircle,
  User, AlertCircle, Save, Building2, Settings2, Shield, Search,
} from 'lucide-react'
import Swal from 'sweetalert2'

const STATUS_CONFIG = {
  active:   { label: 'Ativo',     cls: 'bg-green-100 text-green-800' },
  pending:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-800' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800' },
}

function defaultPerms() {
  return {
    isSuperAdmin: false,
    cargoId: '',
    tiposExtra: [],
    podeVerTodasEmpresas: true,
    empresas: [],
    podeCriarEmpresa: false,
    podeEditarEmpresa: false,
    podeExcluirEmpresa: false,
    podeCriarCredencial: false,
    podeEditarCredencial: false,
    podeExcluirCredencial: false,
  }
}

export default function Users() {
  const { userProfile } = useAuth()
  const { companies } = useCompany()
  const isSuperAdmin = userProfile?.role === 'super_admin'
  // isAdmin kept for transition: old admins can still view the page / pending list
  const isAdmin   = userProfile?.role === 'admin'
  const canAccess = isSuperAdmin || isAdmin

  const [tab, setTab]         = useState(isSuperAdmin ? 'todos' : 'pendentes')
  const [allUsers, setAllUsers] = useState([])
  const [pending, setPending]   = useState([])
  const [cargos, setCargos]     = useState([])
  const [tipos, setTipos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [processing, setProcessing] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ─── Invite modal ────────────────────────────────────────────────────────────
  const [showInvite, setShowInvite]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [invitePerms, setInvitePerms]   = useState(defaultPerms)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError]   = useState('')

  // ─── Edit permissions modal ──────────────────────────────────────────────────
  const [editUser, setEditUser]     = useState(null)
  const [editPerms, setEditPerms]   = useState(defaultPerms)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving]   = useState(false)

  useEffect(() => {
    if (canAccess) fetchData()
  }, [canAccess])

  const fetchData = async () => {
    setLoading(true)
    try {
      const baseQueries = [
        supabase.from('cargos').select('id, nome, cargo_tipo_credencial(tipo_credencial_id)').order('nome'),
        supabase.from('tipos_credencial').select('id, nome, categoria').order('categoria, nome'),
        supabase.from('user_profiles').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
      ]

      if (isSuperAdmin) {
        const [cargosRes, tiposRes, pendingRes, allRes] = await Promise.all([
          ...baseQueries,
          supabase.from('user_profiles').select('*').order('full_name'),
        ])
        if (cargosRes.error) throw cargosRes.error
        if (tiposRes.error)  throw tiposRes.error
        if (pendingRes.error) throw pendingRes.error
        if (allRes.error)    throw allRes.error
        setCargos(cargosRes.data || [])
        setTipos(tiposRes.data || [])
        setPending(pendingRes.data || [])
        setAllUsers(allRes.data || [])
      } else {
        const [cargosRes, tiposRes, pendingRes] = await Promise.all(baseQueries)
        if (cargosRes.error)  throw cargosRes.error
        if (tiposRes.error)   throw tiposRes.error
        if (pendingRes.error) throw pendingRes.error
        setCargos(cargosRes.data || [])
        setTipos(tiposRes.data || [])
        setPending(pendingRes.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  // ─── Aprovação / Rejeição (exclusivo Super Admin) ────────────────────────────
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

  // ─── Convite (exclusivo Super Admin) ─────────────────────────────────────────
  const resetInvite = () => {
    setInviteEmail('')
    setInviteFullName('')
    setInvitePerms(defaultPerms())
    setInviteError('')
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    if (!inviteFullName.trim()) { setInviteError('O nome completo é obrigatório'); return }
    setInviteLoading(true)
    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle()
      if (existing) { setInviteError('Este e-mail já está cadastrado no sistema'); return }

      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/set-password`,
          data: { full_name: inviteFullName },
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

      const isSA = invitePerms.isSuperAdmin
      const { error: profileError } = await supabase.from('user_profiles').insert([{
        id:             authData.user.id,
        email:          inviteEmail,
        full_name:      inviteFullName,
        // Mantém role em sincronia para compatibilidade com realtime do AuthContext
        role:                    isSA ? 'super_admin' : 'básico',
        status:                  'pending',
        invited_by_id:           userProfile?.id || null,
        invited_by_name:         userProfile?.full_name || null,
        // Modelo novo
        is_super_admin:          isSA,
        cargo_id:                isSA ? null : (invitePerms.cargoId || null),
        pode_ver_todas_empresas: isSA ? true  : invitePerms.podeVerTodasEmpresas,
        pode_criar_empresa:      isSA ? false : invitePerms.podeCriarEmpresa,
        pode_editar_empresa:     isSA ? false : invitePerms.podeEditarEmpresa,
        pode_excluir_empresa:    isSA ? false : invitePerms.podeExcluirEmpresa,
        pode_criar_credencial:   isSA ? false : invitePerms.podeCriarCredencial,
        pode_editar_credencial:  isSA ? false : invitePerms.podeEditarCredencial,
        pode_excluir_credencial: isSA ? false : invitePerms.podeExcluirCredencial,
        custom_access_enabled:   false,
      }])
      if (profileError) throw profileError

      if (!isSA && invitePerms.tiposExtra.length > 0) {
        const { error } = await supabase.from('usuario_tipo_credencial_extra').insert(
          invitePerms.tiposExtra.map(tipoId => ({
            usuario_id: authData.user.id,
            tipo_credencial_id: tipoId,
          }))
        )
        if (error) throw error
      }

      if (!isSA && !invitePerms.podeVerTodasEmpresas && invitePerms.empresas.length > 0) {
        const { error } = await supabase.from('usuario_empresa').insert(
          invitePerms.empresas.map(empId => ({
            usuario_id: authData.user.id,
            empresa_id: empId,
          }))
        )
        if (error) throw error
      }

      resetInvite()
      setShowInvite(false)
      await fetchData()
      Swal.fire({
        title: 'Usuário convidado!',
        text: `${inviteEmail} convidado com sucesso. Aguardando aprovação.`,
        icon: 'success',
        timer: 3000,
        showConfirmButton: false,
      })
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

  // ─── Edição de permissões (exclusivo Super Admin) ────────────────────────────
  const openEditPermissions = async (targetUser) => {
    setEditUser(targetUser)
    setEditPerms({
      isSuperAdmin:          targetUser.is_super_admin || false,
      cargoId:               targetUser.cargo_id || '',
      tiposExtra:            [],
      podeVerTodasEmpresas:  targetUser.pode_ver_todas_empresas ?? true,
      empresas:              [],
      podeCriarEmpresa:      targetUser.pode_criar_empresa      || false,
      podeEditarEmpresa:     targetUser.pode_editar_empresa     || false,
      podeExcluirEmpresa:    targetUser.pode_excluir_empresa    || false,
      podeCriarCredencial:   targetUser.pode_criar_credencial   || false,
      podeEditarCredencial:  targetUser.pode_editar_credencial  || false,
      podeExcluirCredencial: targetUser.pode_excluir_credencial || false,
    })
    setEditLoading(true)
    try {
      const [{ data: tiposData, error: e1 }, { data: empData, error: e2 }] = await Promise.all([
        supabase.from('usuario_tipo_credencial_extra').select('tipo_credencial_id').eq('usuario_id', targetUser.id),
        supabase.from('usuario_empresa').select('empresa_id').eq('usuario_id', targetUser.id),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setEditPerms(prev => ({
        ...prev,
        tiposExtra: tiposData?.map(r => r.tipo_credencial_id) || [],
        empresas:   empData?.map(r => r.empresa_id)           || [],
      }))
    } catch (err) {
      Swal.fire({ title: 'Erro', text: 'Não foi possível carregar os dados do usuário.', icon: 'error' })
      setEditUser(null)
    } finally {
      setEditLoading(false)
    }
  }

  const saveEditPermissions = async () => {
    if (!editUser) return
    setEditSaving(true)
    try {
      const isSA = editPerms.isSuperAdmin
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({
          role:                    isSA ? 'super_admin' : 'básico',
          is_super_admin:          isSA,
          cargo_id:                isSA ? null  : (editPerms.cargoId || null),
          pode_ver_todas_empresas: isSA ? true  : editPerms.podeVerTodasEmpresas,
          pode_criar_empresa:      isSA ? false : editPerms.podeCriarEmpresa,
          pode_editar_empresa:     isSA ? false : editPerms.podeEditarEmpresa,
          pode_excluir_empresa:    isSA ? false : editPerms.podeExcluirEmpresa,
          pode_criar_credencial:   isSA ? false : editPerms.podeCriarCredencial,
          pode_editar_credencial:  isSA ? false : editPerms.podeEditarCredencial,
          pode_excluir_credencial: isSA ? false : editPerms.podeExcluirCredencial,
          custom_access_enabled:   false,
        })
        .eq('id', editUser.id)
      if (profileErr) throw profileErr

      // Sincroniza tipos extras: delete-all + insert
      await supabase.from('usuario_tipo_credencial_extra').delete().eq('usuario_id', editUser.id)
      if (!isSA && editPerms.tiposExtra.length > 0) {
        const { error } = await supabase.from('usuario_tipo_credencial_extra').insert(
          editPerms.tiposExtra.map(tipoId => ({
            usuario_id: editUser.id,
            tipo_credencial_id: tipoId,
          }))
        )
        if (error) throw error
      }

      // Sincroniza empresas: delete-all + insert (só se restrito)
      await supabase.from('usuario_empresa').delete().eq('usuario_id', editUser.id)
      if (!isSA && !editPerms.podeVerTodasEmpresas && editPerms.empresas.length > 0) {
        const { error } = await supabase.from('usuario_empresa').insert(
          editPerms.empresas.map(empId => ({
            usuario_id: editUser.id,
            empresa_id: empId,
          }))
        )
        if (error) throw error
      }

      await fetchData()
      setEditUser(null)
      Swal.fire({ title: 'Permissões salvas!', icon: 'success', timer: 2000, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message || 'Erro ao salvar permissões', icon: 'error' })
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Guard ────────────────────────────────────────────────────────────────────
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-ea-surface">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas Super Admins têm acesso a esta área.</p>
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
            {isSuperAdmin && (
              <button
                onClick={() => { resetInvite(); setShowInvite(true) }}
                className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Convidar Usuário</span>
                <span className="sm:hidden">Convidar</span>
              </button>
            )}
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
              cargos={cargos}
              currentUserId={userProfile?.id}
              isSuperAdmin={isSuperAdmin}
              onEditPermissions={openEditPermissions}
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

      {/* ─── Modal: Convidar Usuário ──────────────────────────────────────────── */}
      <Modal
        isOpen={showInvite}
        onClose={() => { setShowInvite(false); resetInvite() }}
        title="Convidar Novo Usuário"
        footer={
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setShowInvite(false); resetInvite() }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="invite-form"
              disabled={inviteLoading}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-6 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteLoading ? 'Criando...' : 'Convidar'}
            </button>
          </div>
        }
      >
        <form id="invite-form" onSubmit={handleInvite} className="space-y-5">
          {inviteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{inviteError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value.toLowerCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="usuario@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={inviteFullName}
              onChange={e => setInviteFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Nome completo do usuário"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tipo de Acesso e Permissões</p>
            <PermissionsSection
              perms={invitePerms}
              onChange={setInvitePerms}
              cargos={cargos}
              tipos={tipos}
              companies={companies}
            />
          </div>
        </form>
      </Modal>

      {/* ─── Modal: Editar Permissões ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Permissões — ${editUser?.full_name || ''}`}
        footer={
          !editLoading && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditPermissions}
                disabled={editSaving}
                className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-6 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )
        }
      >
        {editLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ea-primary" />
          </div>
        ) : (
          <PermissionsSection
            perms={editPerms}
            onChange={setEditPerms}
            cargos={cargos}
            tipos={tipos}
            companies={companies}
          />
        )}
      </Modal>
    </div>
  )
}

// ─── PermissionsSection ───────────────────────────────────────────────────────
// Painel compartilhado entre o modal de convite e o modal de edição.

function PermissionsSection({ perms, onChange, cargos, tipos, companies }) {
  const [searchTipoExtra, setSearchTipoExtra] = useState('')
  const set = (field, value) => onChange(prev => ({ ...prev, [field]: value }))

  const toggleTipoExtra = (tipoId) =>
    set('tiposExtra', perms.tiposExtra.includes(tipoId)
      ? perms.tiposExtra.filter(id => id !== tipoId)
      : [...perms.tiposExtra, tipoId]
    )

  const toggleCategoriaExtra = (tiposDaCategoria) => {
    const ids = tiposDaCategoria.map(t => t.id)
    const allSelected = ids.every(id => perms.tiposExtra.includes(id))
    if (allSelected) {
      set('tiposExtra', perms.tiposExtra.filter(id => !ids.includes(id)))
    } else {
      set('tiposExtra', [...new Set([...perms.tiposExtra, ...ids])])
    }
  }

  const toggleEmpresa = (empId) =>
    set('empresas', perms.empresas.includes(empId)
      ? perms.empresas.filter(id => id !== empId)
      : [...perms.empresas, empId]
    )

  // Tipos que o cargo selecionado já cobre
  const cargoSelecionado = cargos.find(c => c.id === perms.cargoId)
  const tiposDoCargoIds  = new Set(cargoSelecionado?.cargo_tipo_credencial?.map(r => r.tipo_credencial_id) || [])
  const tiposDocargo     = tipos.filter(t => tiposDoCargoIds.has(t.id))

  // Tipos extras: exclui os que já vêm do cargo
  const tiposExtras = tipos.filter(t => !tiposDoCargoIds.has(t.id))

  const tiposByCategoria = tiposExtras.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = []
    acc[t.categoria].push(t)
    return acc
  }, {})

  const filteredTiposByCategoria = searchTipoExtra.trim()
    ? Object.entries(tiposByCategoria).reduce((acc, [cat, tiposDaCategoria]) => {
        const q = searchTipoExtra.toLowerCase()
        const filtered = tiposDaCategoria.filter(t => t.nome.toLowerCase().includes(q))
        if (filtered.length > 0) acc[cat] = filtered
        return acc
      }, {})
    : tiposByCategoria

  return (
    <div className="space-y-4">

      {/* 1. Tipo de acesso: Super Admin ou Usuário com Cargo */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tipo de Acesso</p>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => set('isSuperAdmin', false)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 transition-colors ${
              !perms.isSuperAdmin
                ? 'bg-ea-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            Usuário com Cargo
          </button>
          <button
            type="button"
            onClick={() => set('isSuperAdmin', true)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border-l border-gray-200 transition-colors ${
              perms.isSuperAdmin
                ? 'bg-purple-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            Super Admin
          </button>
        </div>
        {perms.isSuperAdmin && (
          <p className="mt-2 text-xs text-gray-500">
            Super Admin tem acesso total ao sistema, sem restrições de cargo ou empresa.
          </p>
        )}
      </div>

      {!perms.isSuperAdmin && (
        <>
          {/* 2. Cargo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Cargo
            </label>
            {cargos.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nenhum cargo cadastrado.{' '}
                <Link to="/cargos" className="text-ea-accent hover:text-ea-accent-dark underline font-semibold">
                  Criar cargos
                </Link>{' '}
                antes de convidar.
              </p>
            ) : (
              <>
                <select
                  value={perms.cargoId}
                  onChange={e => set('cargoId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent text-sm"
                >
                  <option value="">Sem cargo atribuído</option>
                  {cargos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>

                {perms.cargoId && (
                  <div className="mt-2 p-3 bg-ea-surface border border-ea-border rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Tipos incluídos por este cargo
                      <span className="ml-1 font-normal text-gray-400">({tiposDocargo.length})</span>
                    </p>
                    {tiposDocargo.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhum tipo vinculado a este cargo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tiposDocargo.map(t => (
                          <span
                            key={t.id}
                            className="px-2 py-0.5 text-xs bg-white text-ea-primary rounded-full border border-ea-border"
                          >
                            {t.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Define os tipos de credencial visíveis por padrão.
            </p>
          </div>

          {/* 3. Tipos extras de credencial */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Tipos Extras de Credencial
              {perms.tiposExtra.length > 0 && (
                <span className="ml-2 normal-case font-normal text-ea-accent">
                  +{perms.tiposExtra.length} selecionado{perms.tiposExtra.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 mb-2">
              Tipos visíveis além dos definidos pelo cargo.
            </p>
            {tipos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum tipo de credencial cadastrado.</p>
            ) : (
              <>
                {/* Campo de busca */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTipoExtra}
                    onChange={e => setSearchTipoExtra(e.target.value)}
                    placeholder="Buscar tipos..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                  />
                </div>

                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {Object.entries(filteredTiposByCategoria).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-5">Nenhum tipo encontrado.</p>
                  ) : (
                    Object.entries(filteredTiposByCategoria).map(([cat, tiposDaCategoria]) => {
                      const allSelected  = tiposDaCategoria.every(t => perms.tiposExtra.includes(t.id))
                      const someSelected = tiposDaCategoria.some(t => perms.tiposExtra.includes(t.id))
                      return (
                        <div key={cat}>
                          {/* Categoria — checkbox pai */}
                          <label className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer sticky top-0 z-10">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                              onChange={() => toggleCategoriaExtra(tiposDaCategoria)}
                              className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                            />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{cat}</span>
                            <span className="ml-auto text-xs text-gray-400 font-normal normal-case">
                              {tiposDaCategoria.filter(t => perms.tiposExtra.includes(t.id)).length}/{tiposDaCategoria.length}
                            </span>
                          </label>
                          {/* Filhos */}
                          {tiposDaCategoria.map(tipo => (
                            <label key={tipo.id} className="flex items-center gap-3 pl-10 pr-3 py-2 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.tiposExtra.includes(tipo.id)}
                                onChange={() => toggleTipoExtra(tipo.id)}
                                className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                              />
                              <span className="text-sm text-gray-800">{tipo.nome}</span>
                            </label>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* 4. Ver todas as empresas */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Visibilidade de Empresas
            </p>
            <button
              type="button"
              onClick={() => set('podeVerTodasEmpresas', !perms.podeVerTodasEmpresas)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-ea-primary" />
                <span className="text-sm font-medium text-gray-700">Ver todas as empresas</span>
              </div>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                perms.podeVerTodasEmpresas ? 'bg-ea-accent' : 'bg-gray-300'
              }`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  perms.podeVerTodasEmpresas ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </div>
            </button>

            {!perms.podeVerTodasEmpresas && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">
                  Selecione as empresas que este usuário poderá visualizar:
                </p>
                {companies.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma empresa cadastrada.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {companies.map(emp => (
                      <label key={emp.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perms.empresas.includes(emp.id)}
                          onChange={() => toggleEmpresa(emp.id)}
                          className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                        />
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-800">{emp.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Permissões de ação */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Permissões de Ação
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Empresa</p>
                <div className="space-y-2">
                  {[
                    { key: 'podeCriarEmpresa',   label: 'Criar' },
                    { key: 'podeEditarEmpresa',  label: 'Editar' },
                    { key: 'podeExcluirEmpresa', label: 'Excluir' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms[key]}
                        onChange={e => set(key, e.target.checked)}
                        className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Credencial</p>
                <div className="space-y-2">
                  {[
                    { key: 'podeCriarCredencial',   label: 'Criar' },
                    { key: 'podeEditarCredencial',  label: 'Editar' },
                    { key: 'podeExcluirCredencial', label: 'Excluir' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms[key]}
                        onChange={e => set(key, e.target.checked)}
                        className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── AllUsersTab ──────────────────────────────────────────────────────────────

function AllUsersTab({ users, cargos, currentUserId, isSuperAdmin, onEditPermissions }) {
  const getCargoBadge = (u) => {
    if (u.is_super_admin) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
          Super Admin
        </span>
      )
    }
    if (u.cargo_id) {
      const cargo = cargos.find(c => c.id === u.cargo_id)
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          {cargo?.nome || 'Cargo desconhecido'}
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
        Sem cargo
      </span>
    )
  }

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
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo / Acesso</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-ea-primary" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                <td className="py-3 px-4">{getCargoBadge(u)}</td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[u.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_CONFIG[u.status]?.label || u.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {isSuperAdmin && u.id !== currentUserId && (
                    <button
                      onClick={() => onEditPermissions(u)}
                      className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                      title="Editar permissões"
                    >
                      <Settings2 className="w-4 h-4" />
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
        {users.map(u => (
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
                    {getCargoBadge(u)}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[u.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_CONFIG[u.status]?.label || u.status}
                    </span>
                  </div>
                </div>
              </div>
              {isSuperAdmin && u.id !== currentUserId && (
                <button
                  onClick={() => onEditPermissions(u)}
                  className="p-1.5 text-ea-primary hover:bg-ea-surface rounded flex-shrink-0"
                  title="Editar permissões"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PendingTab ───────────────────────────────────────────────────────────────

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
        {pending.map(u => (
          <li key={u.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-ea-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{u.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  <div className="mt-1">
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
