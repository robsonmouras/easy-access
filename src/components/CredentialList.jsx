import CredentialCard from './CredentialCard'
import { Loader2 } from 'lucide-react'

const CredentialList = ({ credentials, loading, onEdit, onDelete }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ea-primary" />
      </div>
    )
  }

  if (credentials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600 mb-2">Nenhuma credencial encontrada</p>
        <p className="text-sm text-gray-500">
          {loading ? 'Carregando...' : 'Esta empresa ainda não possui credenciais cadastradas.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop: Tabela */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Link
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {credentials.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                onEdit={onEdit}
                onDelete={onDelete}
                isTableRow={true}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {credentials.map((credential) => (
          <CredentialCard
            key={credential.id}
            credential={credential}
            onEdit={onEdit}
            onDelete={onDelete}
            isTableRow={false}
          />
        ))}
      </div>
    </div>
  )
}

export default CredentialList

