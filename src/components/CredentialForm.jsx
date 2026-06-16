import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, Users, Key } from 'lucide-react'
import Modal from './Modal'

const CredentialForm = ({ credential, onClose, companyId }) => {
  const { userProfile } = useAuth()

  const [formData, setFormData] = useState({
    name: '',
    type: 'hospedagem',
    link: '',
    login: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // HU4: etapa de exceções de acesso
  const [step, setStep] = useState('form') // 'form' | 'access'
  const [newCredentialId, setNewCredentialId] = useState(null)
  const [accessUsers, setAccessUsers] = useState([]) // usuários com acesso à empresa desta credencial
  const [visibleUserIds, setVisibleUserIds] = useState(new Set()) // todos marcados por padrão
  const [accessSaving, setAccessSaving] = useState(false)

  useEffect(() => {
    if (credential) {
      setFormData({
        name: credential.name || '',
        type: credential.type || 'hospedagem',
        link: credential.link || '',
        login: credential.login || '',
        password: credential.password || '',
      })
    }
  }, [credential])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (credential) {
        // Edição: sem etapa de acesso (apenas criação gera a etapa)
        const { error } = await supabase
          .from('credentials')
          .update({
            name: formData.name,
            type: formData.type,
            link: formData.link,
            login: formData.login,
            password: formData.password,
          })
          .eq('id', credential.id)
        if (error) throw error
        onClose()
      } else {
        // Criação: verificar se há usuários com personalização que têm acesso à empresa
        const { data: newCred, error: insertErr } = await supabase
          .from('credentials')
          .insert([{
            company_id: companyId,
            name: formData.name,
            type: formData.type,
            link: formData.link,
            login: formData.login,
            password: formData.password,
          }])
          .select()
          .single()
        if (insertErr) throw insertErr

        // Busca usuários com custom_access_enabled que têm acesso à empresa desta credencial
        const { data: usersWithAccess } = await supabase
          .from('user_company_access')
          .select('user_id, user:user_profiles!user_company_access_user_id_fkey(id, full_name, email, custom_access_enabled, status)')
          .eq('company_id', companyId)

        const eligible = (usersWithAccess || [])
          .filter(r => r.user?.custom_access_enabled && r.user?.status === 'active')
          .map(r => r.user)

        if (eligible.length > 0) {
          setNewCredentialId(newCred.id)
          setAccessUsers(eligible)
          setVisibleUserIds(new Set(eligible.map(u => u.id))) // todos visíveis por padrão
          setStep('access')
        } else {
          onClose()
        }
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar credencial')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAccess = async () => {
    setAccessSaving(true)
    try {
      // Usuários DESMARCADOS recebem uma exceção (não verão esta credencial)
      const hiddenUserIds = accessUsers
        .map(u => u.id)
        .filter(id => !visibleUserIds.has(id))

      if (hiddenUserIds.length > 0) {
        const rows = hiddenUserIds.map(userId => ({
          user_id: userId,
          credential_id: newCredentialId,
          created_by: userProfile?.id || null,
        }))
        const { error } = await supabase.from('user_credential_exceptions').insert(rows)
        if (error) throw error
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar exceções de acesso')
    } finally {
      setAccessSaving(false)
    }
  }

  const toggleUser = (userId) => {
    setVisibleUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) { next.delete(userId) } else { next.add(userId) }
      return next
    })
  }

  // ─── Etapa 1: formulário da credencial ──────────────────────────────────────
  if (step === 'form') {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={credential ? 'Editar Credencial' : 'Nova Credencial'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Credencial *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Ex: Hospedagem Principal"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo *
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
            >
              <option value="hospedagem">Hospedagem</option>
              <option value="servidor">Servidor</option>
              <option value="registro.br">Registro.br</option>
              <option value="wordpress">WordPress</option>
              <option value="rd_station">RD Station</option>
              <option value="ftp_ssh">FTP/SSH</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          <div>
            <label htmlFor="link" className="block text-sm font-medium text-gray-700 mb-1">
              Link / URL <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              id="link"
              type="text"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          <div>
            <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
              Login *
            </label>
            <input
              id="login"
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="usuário ou e-mail"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha *
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-ea-primary rounded-lg text-ea-primary font-medium hover:bg-ea-primary hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  // ─── Etapa 2: quem verá esta credencial (HU4) ───────────────────────────────
  return (
    <Modal isOpen={true} onClose={onClose} title="Quem verá esta credencial?">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Key className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Credencial <strong>{formData.name}</strong> criada. Os usuários abaixo têm acesso a esta empresa — desmarque quem não deverá ver esta credencial.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuários com acesso à empresa ({accessUsers.length})
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setVisibleUserIds(new Set(accessUsers.map(u => u.id)))}
                className="text-ea-primary hover:underline"
              >
                Todos
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setVisibleUserIds(new Set())}
                className="text-ea-primary hover:underline"
              >
                Nenhum
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {accessUsers.map(u => (
              <label
                key={u.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleUserIds.has(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {visibleUserIds.size} de {accessUsers.length} usuário{accessUsers.length !== 1 ? 's' : ''} verá{visibleUserIds.size !== 1 ? 'o' : ''} esta credencial
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Pular
          </button>
          <button
            onClick={handleConfirmAccess}
            disabled={accessSaving}
            className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {accessSaving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default CredentialForm
