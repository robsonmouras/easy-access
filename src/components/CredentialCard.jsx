import { useState } from 'react'
import { Eye, EyeOff, Copy, Edit, Trash2, ExternalLink, Check } from 'lucide-react'
import Modal from './Modal'

const CredentialCard = ({ credential, onEdit, onDelete, isTableRow }) => {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState({ login: false, password: false })
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied({ ...copied, [type]: true })
      setTimeout(() => {
        setCopied({ ...copied, [type]: false })
      }, 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const getTypeLabel = (type) => {
    const types = {
      hospedagem: 'Hospedagem',
      servidor: 'Servidor',
      'registro.br': 'Registro.br',
      wordpress: 'WordPress',
      rd_station: 'RD Station',
      ftp_ssh: 'FTP/SSH',
      mysql: 'MySQL',
    }
    return types[type] || type
  }

  const getTypeColor = (type) => {
    const colors = {
      hospedagem: 'bg-red-100 text-red-800',
      servidor: 'bg-green-100 text-green-800',
      'registro.br': 'bg-purple-100 text-purple-800',
      wordpress: 'bg-blue-100 text-blue-800',
      rd_station: 'bg-orange-100 text-orange-800',
      ftp_ssh: 'bg-yellow-100 text-yellow-800',
      mysql: 'bg-cyan-100 text-cyan-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (isTableRow) {
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(credential.type)}`}>
            {getTypeLabel(credential.type)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{credential.name}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900">{credential.login}</span>
            <button
              onClick={() => copyToClipboard(credential.login, 'login')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Copiar login"
            >
              {copied.login ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {credential.link ? (
            <a
              href={credential.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-ea-primary hover:underline"
            >
              <span className="truncate max-w-xs">{credential.link}</span>
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-ea-primary hover:text-ea-neutral-800 text-sm"
            >
              Ver Senha
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(credential)}
                className="p-1 text-ea-primary hover:text-ea-neutral-800 hover:bg-gray-100 rounded"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(credential.id)}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                title="Deletar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>

        {/* Modal para senha */}
        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false)
            setShowPassword(false)
          }}
          title={`Senha - ${credential.name}`}
        >
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              value={credential.password || ''}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-gray-600" />
              ) : (
                <Eye className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => copyToClipboard(credential.password, 'password')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copiar senha"
            >
              {copied.password ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </Modal>
      </tr>
    )
  }

  // Mobile Card
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{credential.name}</h3>
          <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(credential.type)}`}>
            {getTypeLabel(credential.type)}
          </span>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(credential)}
              className="p-2 text-ea-primary hover:bg-ea-surface rounded-lg"
            >
              <Edit className="w-5 h-5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(credential.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Login</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={credential.login || ''}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={() => copyToClipboard(credential.login, 'login')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {copied.login ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Senha</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={credential.password || ''}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-gray-600" />
              ) : (
                <Eye className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => copyToClipboard(credential.password, 'password')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {copied.password ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {credential.link && (
          <div>
            <label className="text-xs text-gray-500">Link</label>
            <a
              href={credential.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-1 text-sm text-ea-primary hover:underline"
            >
              <span className="truncate">{credential.link}</span>
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default CredentialCard

