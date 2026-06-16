import { useNavigate } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { Building2, Plus, X } from 'lucide-react'

const Sidebar = ({ sidebarOpen, setSidebarOpen, showCompanyForm, setShowCompanyForm }) => {
  const { companies, selectedCompany, setSelectedCompany } = useCompany()
  const { userProfile } = useAuth()
  const navigate = useNavigate()

  const canManageCompanies = userProfile?.role === 'super_admin' || userProfile?.role === 'admin'

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-white shadow-lg md:shadow-none
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          border-r border-gray-200
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-ea-dark">Empresas</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {companies.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhuma empresa cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company)
                      navigate(`/dashboard?company=${company.id}`)
                      setSidebarOpen(false)
                    }}
                    className={`
                      w-full text-left p-3 rounded-lg transition-colors
                      flex items-center gap-3
                      ${
                        selectedCompany?.id === company.id
                          ? 'bg-ea-primary text-white'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }
                    `}
                  >
                    <Building2 className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{company.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {canManageCompanies && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCompanyForm(true)
                  setSidebarOpen(false)
                }}
                className="w-full flex items-center justify-center gap-2 bg-ea-accent text-white px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Empresa
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar

