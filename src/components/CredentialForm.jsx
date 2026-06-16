import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Save } from 'lucide-react'
import Modal from './Modal'

const CredentialForm = ({ credential, onClose, companyId }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'hospedagem',
    link: '',
    login: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        // Editar
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
      } else {
        // Criar
        const { error } = await supabase
          .from('credentials')
          .insert([
            {
              company_id: companyId,
              name: formData.name,
              type: formData.type,
              link: formData.link,
              login: formData.login,
              password: formData.password,
            },
          ])

        if (error) throw error
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar credencial')
    } finally {
      setLoading(false)
    }
  }

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

export default CredentialForm

