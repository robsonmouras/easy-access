import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, AlertCircle } from 'lucide-react'
import Modal from './Modal'

const CredentialForm = ({ credential, onClose, companyId }) => {
  const { userProfile } = useAuth()

  const [formData, setFormData] = useState({
    name: '',
    tipo_credencial_id: '',
    link: '',
    login: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tiposVisiveis, setTiposVisiveis] = useState([])
  const [loadingTipos, setLoadingTipos] = useState(true)

  // Carrega tipos visíveis para o usuário logado
  useEffect(() => {
    loadTiposVisiveis()
  }, [userProfile])

  const loadTiposVisiveis = async () => {
    if (!userProfile) return
    setLoadingTipos(true)
    try {
      const isSA = userProfile?.is_super_admin === true || userProfile?.role === 'super_admin'
      let tipos = []
      if (isSA) {
        const { data } = await supabase
          .from('tipos_credencial')
          .select('id, nome, categoria')
          .order('categoria, nome')
        tipos = data || []
      } else {
        const { data: ids } = await supabase.rpc('tipos_visiveis', { p_usuario_id: userProfile.id })
        if (ids && ids.length > 0) {
          const { data } = await supabase
            .from('tipos_credencial')
            .select('id, nome, categoria')
            .in('id', ids.map(r => r.tipo_credencial_id))
            .order('categoria, nome')
          tipos = data || []
        }
      }
      setTiposVisiveis(tipos)

      // Pré-carrega os dados da credencial após ter a lista de tipos
      if (credential) {
        setFormData({
          name:              credential.name || '',
          tipo_credencial_id: credential.tipo_credencial_id || '',
          link:              credential.link || '',
          login:             credential.login || '',
          password:          credential.password || '',
        })
      } else if (tipos.length > 0) {
        // Novo: pré-seleciona o primeiro tipo disponível
        setFormData(prev => ({ ...prev, tipo_credencial_id: tipos[0].id }))
      }
    } catch (err) {
      console.error('Erro ao carregar tipos de credencial:', err)
    } finally {
      setLoadingTipos(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.tipo_credencial_id) {
      setError('Selecione o tipo de credencial.')
      return
    }

    setLoading(true)
    try {
      const selectedTipo = tiposVisiveis.find(t => t.id === formData.tipo_credencial_id)

      const payload = {
        name:              formData.name,
        tipo_credencial_id: formData.tipo_credencial_id,
        link:              formData.link,
        login:             formData.login,
        password:          formData.password,
      }

      if (credential) {
        const { error } = await supabase
          .from('credentials')
          .update(payload)
          .eq('id', credential.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('credentials')
          .insert([{ company_id: companyId, ...payload }])
        if (error) throw error
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar credencial')
    } finally {
      setLoading(false)
    }
  }

  // Agrupa tipos por categoria para o select
  const tiposByCategoria = tiposVisiveis.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = []
    acc[t.categoria].push(t)
    return acc
  }, {})

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={credential ? 'Editar Credencial' : 'Nova Credencial'}
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="credential-form"
            disabled={loading || tiposVisiveis.length === 0}
            className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-6 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      }
    >
      <form id="credential-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
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
          <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo *
          </label>
          {loadingTipos ? (
            <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">
              Carregando tipos...
            </div>
          ) : tiposVisiveis.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Nenhum tipo de credencial disponível para o seu cargo. Solicite ao Super Admin que adicione tipos ao seu cargo.
            </div>
          ) : (
            <select
              id="tipo"
              value={formData.tipo_credencial_id}
              onChange={(e) => setFormData({ ...formData, tipo_credencial_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
            >
              {!formData.tipo_credencial_id && (
                <option value="">Selecione um tipo...</option>
              )}
              {Object.entries(tiposByCategoria).map(([categoria, tipos]) => (
                <optgroup key={categoria} label={categoria}>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
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
      </form>
    </Modal>
  )
}

export default CredentialForm
