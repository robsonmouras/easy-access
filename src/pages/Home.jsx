import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import CompanyForm from '../components/CompanyForm'
import { Building2, Plus, Search, Trash2, Key, ArrowRight, MoreVertical, Pencil } from 'lucide-react'
import Swal from 'sweetalert2'

const Home = () => {
  const { userProfile } = useAuth()
  const { companies, fetchCompanies, deleteCompany, setSelectedCompany } = useCompany()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [companiesWithCount, setCompaniesWithCount] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isSuperAdmin      = userProfile?.is_super_admin === true || userProfile?.role === 'super_admin'
  const canCreateCompany  = isSuperAdmin || !!userProfile?.pode_criar_empresa
  const canEditCompany    = isSuperAdmin || !!userProfile?.pode_editar_empresa
  const canDeleteCompany  = isSuperAdmin || !!userProfile?.pode_excluir_empresa
  const canManageMenu     = canEditCompany || canDeleteCompany

  useEffect(() => {
    fetchCompaniesWithCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, searchTerm])

  const fetchCompaniesWithCredentials = async () => {
    setLoading(true)
    try {
      const companiesData = await Promise.all(
        companies.map(async (company) => {
          const { count, error } = await supabase
            .from('credentials')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          if (error) throw error

          return {
            ...company,
            credentialsCount: count || 0,
          }
        })
      )

      // Usuários sem super admin não veem empresas sem credenciais visíveis para eles
      const withVisibility = isSuperAdmin
        ? companiesData
        : companiesData.filter((c) => c.credentialsCount > 0)

      // Filtrar por busca
      const filtered = withVisibility.filter((company) =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )

      setCompaniesWithCount(filtered)
    } catch (error) {
      console.error('Erro ao buscar empresas com credenciais:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = async (company) => {
    const { value: typed } = await Swal.fire({
      title: 'Deletar Empresa',
      html: `
        <p class="text-sm text-gray-600 mb-3">Esta ação irá deletar permanentemente a empresa <strong>${company.name}</strong> e todas as suas credenciais. Esta ação não pode ser desfeita.</p>
        <p class="text-sm font-medium text-gray-700 mb-1">Para confirmar, digite o nome da empresa:</p>
      `,
      input: 'text',
      inputPlaceholder: company.name,
      inputAttributes: { autocomplete: 'off' },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deletar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (value !== company.name) return 'O nome digitado não corresponde ao nome da empresa.'
      },
    })

    if (typed !== company.name) return

    try {
      await deleteCompany(company.id)
      Swal.fire({ title: 'Empresa deletada!', icon: 'success', timer: 2000, showConfirmButton: false })
      setTimeout(() => fetchCompaniesWithCredentials(), 500)
    } catch (error) {
      console.error('Erro ao deletar empresa:', error)
      Swal.fire({ title: 'Erro', text: 'Não foi possível deletar a empresa. Tente novamente.', icon: 'error' })
    }
  }

  const handleCompanyClick = (company) => {
    // Atualizar empresa selecionada no contexto
    setSelectedCompany(company)
    navigate(`/dashboard?company=${company.id}`)
  }

  return (
    <div className="min-h-screen bg-ea-surface">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-ea-dark mb-2">Empresas</h1>
                <p className="text-gray-600">
                  {companiesWithCount.length} empresa(s) cadastrada(s)
                </p>
              </div>

              {canCreateCompany && (
                <button
                  onClick={() => setShowCompanyForm(true)}
                  className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Nova Empresa
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar empresas por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              />
            </div>
          </div>

          {openMenuId && (
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ea-primary"></div>
            </div>
          ) : companiesWithCount.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
              </p>
              {canCreateCompany && !searchTerm && (
                <button
                  onClick={() => setShowCompanyForm(true)}
                  className="bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                >
                  Criar Primeira Empresa
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companiesWithCount.map((company) => (
                <div
                  key={company.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer"
                  onClick={() => handleCompanyClick(company)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-ea-primary bg-opacity-10 rounded-lg">
                        <Building2 className="w-6 h-6 text-ea-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-gray-900 truncate">
                          {company.name}
                        </h3>
                        {company.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {company.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {canManageMenu && (
                      <div className="relative z-50" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === company.id ? null : company.id)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Opções"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {openMenuId === company.id && (
                          <div className="absolute right-0 top-9 bg-white border border-gray-200 shadow-lg rounded-lg z-50 py-1 min-w-[130px]">
                            {canEditCompany && (
                              <button
                                onClick={() => { setEditingCompany(company); setOpenMenuId(null) }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Pencil className="w-4 h-4" />
                                Editar
                              </button>
                            )}
                            {canDeleteCompany && (
                              <button
                                onClick={() => { handleDeleteClick(company); setOpenMenuId(null) }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Key className="w-4 h-4" />
                      <span>
                        {company.credentialsCount} credencial{company.credentialsCount !== 1 ? 'is' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-ea-primary text-sm font-medium">
                      <span>Ver credenciais</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {(showCompanyForm || editingCompany) && (
        <CompanyForm
          company={editingCompany || null}
          onClose={() => { setShowCompanyForm(false); setEditingCompany(null) }}
        />
      )}

    </div>
  )
}

export default Home

