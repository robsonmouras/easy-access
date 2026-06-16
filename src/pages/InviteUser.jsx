import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { Mail, User, Shield, AlertCircle, CheckCircle } from 'lucide-react'

const InviteUser = () => {
  const { userProfile } = useAuth()
  const [formData, setFormData] = useState({ email: '', fullName: '', role: 'básico' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isSuperAdmin = userProfile?.role === 'super_admin'
  const isAdmin = userProfile?.role === 'admin'
  const canAccess = isSuperAdmin || isAdmin

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-ea-surface">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas Admins e Super Admins podem convidar novos usuários.</p>
          </div>
        </div>
      </div>
    )
  }

  // Admin can only assign roles below their own level
  const availableRoles = isSuperAdmin
    ? [{ value: 'básico', label: 'Básico — Apenas visualização' }, { value: 'admin', label: 'Admin — Criar e editar credenciais' }]
    : [{ value: 'básico', label: 'Básico — Apenas visualização' }]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.fullName.trim()) {
      setError('O nome completo é obrigatório')
      return
    }

    setLoading(true)

    try {
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', formData.email)
        .maybeSingle()

      if (existingUser) {
        setError('Este e-mail já está cadastrado no sistema')
        setLoading(false)
        return
      }

      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/set-password`,
          data: { full_name: formData.fullName },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          setError('Este e-mail já está cadastrado no sistema')
          setLoading(false)
          return
        }
        throw authError
      }

      if (!authData.user) throw new Error('Erro ao criar usuário')

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          role: formData.role,
          status: 'pending',
        }])

      if (profileError) throw profileError

      setSuccess(`Usuário ${formData.email} criado e aguardando aprovação de um Super Admin. O e-mail de acesso será enviado somente após aprovação.`)
      setFormData({ email: '', fullName: '', role: 'básico' })
    } catch (err) {
      setError(err.message || 'Erro ao criar usuário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ea-surface">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-ea-dark mb-2">Convidar Novo Usuário</h1>
              <p className="text-gray-600">O usuário ficará pendente até aprovação de um Super Admin.</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  E-mail *
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Nome Completo *
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                  placeholder="Nome completo do usuário"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Perfil de Acesso *
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {isAdmin && (
                  <p className="mt-1 text-xs text-gray-500">Admins podem convidar apenas usuários Básico.</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setFormData({ email: '', fullName: '', role: 'básico' }); setError(''); setSuccess('') }}
                  className="flex-1 px-4 py-2 border-2 border-ea-primary rounded-lg text-ea-primary font-medium hover:bg-ea-primary hover:text-white transition-colors"
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default InviteUser
