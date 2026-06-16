import { useState } from 'react'
import { AlertTriangle, X, Trash2 } from 'lucide-react'
import Modal from './Modal'

const DeleteCompanyModal = ({ company, onClose, onConfirm }) => {
  const [confirmName, setConfirmName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (confirmName !== company.name) {
      return
    }

    setLoading(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error('Erro ao deletar:', error)
    } finally {
      setLoading(false)
    }
  }

  const isConfirmValid = confirmName === company.name

  return (
    <Modal isOpen={true} onClose={onClose} title="Deletar Empresa">
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Atenção: Ação Irreversível</h3>
              <p className="text-sm text-red-700">
                Esta ação irá deletar permanentemente a empresa <strong>"{company.name}"</strong> e
                <strong> todas as {company.credentialsCount || 0} credenciais</strong> associadas a ela.
              </p>
              <p className="text-sm text-red-700 mt-2 font-semibold">
                Esta ação não pode ser desfeita!
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="confirmName" className="block text-sm font-medium text-gray-700 mb-2">
            Para confirmar, digite o nome da empresa: <strong>{company.name}</strong>
          </label>
          <input
            id="confirmName"
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Digite o nome da empresa"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            autoFocus
          />
          {confirmName && !isConfirmValid && (
            <p className="mt-2 text-sm text-red-600">
              O nome digitado não corresponde ao nome da empresa.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border-2 border-ea-primary rounded-lg text-ea-primary font-medium hover:bg-ea-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmValid || loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Deletando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Deletar Empresa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteCompanyModal

