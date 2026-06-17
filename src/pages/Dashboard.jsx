import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import CredentialList from '../components/CredentialList'
import CredentialForm from '../components/CredentialForm'
import CompanyForm from '../components/CompanyForm'
import { Plus, Search, Filter, Home as HomeIcon } from 'lucide-react'
import Swal from 'sweetalert2'

const Dashboard = () => {
  const { userProfile } = useAuth()
  const { selectedCompany, companies, setSelectedCompany } = useCompany()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCredentialForm, setShowCredentialForm] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Carrega tipos visíveis ao usuário (para o filtro)
  useEffect(() => {
    if (userProfile) loadTiposVisiveis()
  }, [userProfile])

  const loadTiposVisiveis = async () => {
    try {
      const isSA = userProfile?.is_super_admin === true || userProfile?.role === 'super_admin'
      if (isSA) {
        const { data } = await supabase
          .from('tipos_credencial')
          .select('id, nome, categoria')
          .order('categoria, nome')
        setTiposVisiveis(data || [])
      } else {
        const { data: ids } = await supabase.rpc('tipos_visiveis', { p_usuario_id: userProfile.id })
        if (!ids || ids.length === 0) { setTiposVisiveis([]); return }
        const { data } = await supabase
          .from('tipos_credencial')
          .select('id, nome, categoria')
          .in('id', ids.map(r => r.tipo_credencial_id))
          .order('categoria, nome')
        setTiposVisiveis(data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar tipos visíveis:', err)
    }
  }

  const isSuperAdmin = userProfile?.is_super_admin === true || userProfile?.role === 'super_admin'
  const canCreate    = isSuperAdmin || !!userProfile?.pode_criar_credencial
  const canEdit      = isSuperAdmin || !!userProfile?.pode_editar_credencial
  const canDelete    = isSuperAdmin || !!userProfile?.pode_excluir_credencial

  const [tiposVisiveis, setTiposVisiveis] = useState([])
  const [filterTipoId, setFilterTipoId] = useState('all')

  // Verificar se há empresa na URL
  useEffect(() => {
    const companyId = searchParams.get('company')
    if (companyId && companies.length > 0) {
      const company = companies.find((c) => c.id === companyId)
      if (company && company.id !== selectedCompany?.id) {
        setSelectedCompany(company)
      }
    } else if (!companyId && selectedCompany && companies.length > 0) {
      // Se não há empresa na URL mas há uma selecionada, atualizar URL
      navigate(`/dashboard?company=${selectedCompany.id}`, { replace: true })
    } else if (!companyId && !selectedCompany && companies.length > 0) {
      // Se não há empresa selecionada nem na URL, selecionar a primeira
      const firstCompany = companies[0]
      setSelectedCompany(firstCompany)
      navigate(`/dashboard?company=${firstCompany.id}`, { replace: true })
    }
  }, [searchParams, companies, selectedCompany, setSelectedCompany, navigate])

  useEffect(() => {
    if (selectedCompany) {
      fetchCredentials()
    } else {
      setCredentials([])
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, filterTipoId])

  const fetchCredentials = async () => {
    if (!selectedCompany) {
      setCredentials([])
      setError('')
      return
    }

    setLoading(true)
    setError('')
    
    // console.log('Buscando credenciais para empresa:', selectedCompany.id, selectedCompany.name)
    
    try {
      let query = supabase
        .from('credentials')
        .select('*, tipos_credencial(id, nome, categoria)')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false })

      if (filterTipoId !== 'all') {
        query = query.eq('tipo_credencial_id', filterTipoId)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        console.error('Erro ao buscar credenciais:', queryError)
        setError(`Erro ao carregar credenciais: ${queryError.message}`)
        setCredentials([])
        return
      }

    //   console.log('Credenciais encontradas:', data?.length || 0)
      setCredentials(data || [])
    } catch (err) {
      console.error('Erro ao buscar credenciais:', err)
      setError(`Erro inesperado: ${err.message || 'Não foi possível carregar as credenciais'}`)
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCredential = () => {
    setEditingCredential(null)
    setShowCredentialForm(true)
  }

  const handleEditCredential = (credential) => {
    setEditingCredential(credential)
    setShowCredentialForm(true)
  }

  const handleDeleteCredential = async (id) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Deletar credencial?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deletar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })

    if (!isConfirmed) return

    try {
      const { error } = await supabase
        .from('credentials')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchCredentials()
    } catch (error) {
      console.error('Erro ao deletar credencial:', error)
      Swal.fire({ title: 'Erro', text: 'Não foi possível deletar a credencial.', icon: 'error' })
    }
  }

  const handleFormClose = () => {
    setShowCredentialForm(false)
    setEditingCredential(null)
    fetchCredentials()
  }

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch =
      cred.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.login?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      selectedCompany?.name?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-ea-surface">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex">
        <Sidebar 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
          showCompanyForm={showCompanyForm}
          setShowCompanyForm={setShowCompanyForm}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {!selectedCompany ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">Selecione uma empresa para começar</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                >
                  <HomeIcon className="w-4 h-4" />
                  Ver Todas as Empresas
                </button>
                {companies.length === 0 && (
                  <button
                    onClick={() => setShowCompanyForm(true)}
                    className="bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                  >
                    Criar Primeira Empresa
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={fetchCredentials}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigate('/')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Voltar para Home"
                    >
                      <HomeIcon className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                      <h1 className="text-2xl font-bold text-ea-dark">
                        Credenciais - {selectedCompany.name}
                      </h1>
                      <p className="text-gray-600 text-sm mt-1">
                        {loading ? 'Carregando...' : `${filteredCredentials.length} credencial(is) encontrada(s)`}
                      </p>
                    </div>
                  </div>

                  {canCreate && (
                    <button
                      onClick={handleCreateCredential}
                      className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Nova Credencial
                    </button>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, login ou empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                    />
                  </div>

                  {tiposVisiveis.length > 0 && (
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <select
                        value={filterTipoId}
                        onChange={(e) => setFilterTipoId(e.target.value)}
                        className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent appearance-none bg-white"
                      >
                        <option value="all">Todos os tipos</option>
                        {tiposVisiveis.map((t) => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <CredentialList
                credentials={filteredCredentials}
                loading={loading}
                onEdit={canEdit ? handleEditCredential : null}
                onDelete={canDelete ? handleDeleteCredential : null}
              />
            </>
          )}
        </main>
      </div>

      {showCredentialForm && (
        <CredentialForm
          credential={editingCredential}
          onClose={handleFormClose}
          companyId={selectedCompany?.id}
        />
      )}

      {showCompanyForm && (
        <CompanyForm
          onClose={() => setShowCompanyForm(false)}
        />
      )}
    </div>
  )
}

export default Dashboard

