import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { CheckCircle, XCircle, Clock, AlertCircle, User } from 'lucide-react'
import Swal from 'sweetalert2'

const UserApproval = () => {
  const { userProfile } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetchPending()
  }, [])

  const fetchPending = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      setPending(data || [])
    } catch (err) {
      console.error('Erro ao buscar pendentes:', err)
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

      // Dispara o e-mail de acesso somente após aprovação
      const { error: emailError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/set-password`,
      })

      if (emailError) {
        console.error('Aviso: usuário aprovado mas e-mail não enviado:', emailError)
      }

      await fetchPending()
    } catch (err) {
      console.error('Erro ao aprovar:', err)
      Swal.fire({ title: 'Erro', text: 'Erro ao aprovar usuário: ' + err.message, icon: 'error' })
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
      await fetchPending()
    } catch (err) {
      console.error('Erro ao rejeitar:', err)
      Swal.fire({ title: 'Erro', text: 'Erro ao rejeitar usuário: ' + err.message, icon: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  const getRoleLabel = (role) => ({ super_admin: 'Super Admin', admin: 'Admin', básico: 'Básico' }[role] || role)

  if (userProfile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-ea-surface">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas Super Admins podem aprovar usuários.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ea-surface">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-ea-dark mb-1">Aprovação de Usuários</h1>
            <p className="text-gray-600">Usuários aguardando liberação de acesso ao sistema.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ea-primary"></div>
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma aprovação pendente</h2>
              <p className="text-gray-500">Todos os usuários foram processados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-ea-accent" />
                <span className="font-semibold text-gray-900">
                  {pending.length} usuário{pending.length !== 1 ? 's' : ''} aguardando aprovação
                </span>
              </div>

              <ul className="divide-y divide-gray-100">
                {pending.map((u) => (
                  <li key={u.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-ea-surface flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-ea-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.full_name}</p>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {getRoleLabel(u.role)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={processing === u.id}
                        className="flex items-center gap-1.5 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        disabled={processing === u.id}
                        className="flex items-center gap-1.5 px-4 py-2 border-2 border-red-500 text-red-500 font-medium rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default UserApproval
