import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Modal from '../components/Modal'
import { Tag, Plus, Pencil, Trash2, AlertCircle, Save, Search } from 'lucide-react'
import Swal from 'sweetalert2'

const CATEGORIAS_PADRAO = [
  'Desenvolvimento & Infraestrutura',
  'CMS & Plataformas de Site',
  'Redes Sociais',
  'Marketing & Tráfego Pago',
  'Email Marketing & CRM',
  'Design & Produção',
  'Financeiro & Administrativo',
  'Atendimento & Suporte',
  'Gestão Interna',
]

export default function TiposCredencial() {
  const { userProfile } = useAuth()
  const isSuperAdmin = userProfile?.role === 'super_admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingTipo, setEditingTipo] = useState(null)
  const [form, setForm] = useState({ nome: '', categoria: CATEGORIAS_PADRAO[0] })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tipos_credencial')
        .select('id, nome, categoria, created_at')
        .order('categoria, nome')
      if (error) throw error
      setTipos(data || [])
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message, icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingTipo(null)
    setForm({ nome: '', categoria: CATEGORIAS_PADRAO[0] })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (tipo) => {
    setEditingTipo(tipo)
    setForm({ nome: tipo.nome, categoria: tipo.categoria })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const nome = form.nome.trim()
    const categoria = form.categoria.trim()
    if (!nome) { setFormError('O nome é obrigatório.'); return }
    if (!categoria) { setFormError('A categoria é obrigatória.'); return }
    setSaving(true)
    setFormError('')
    try {
      if (editingTipo) {
        const { error } = await supabase
          .from('tipos_credencial')
          .update({ nome, categoria })
          .eq('id', editingTipo.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tipos_credencial')
          .insert([{ nome, categoria }])
        if (error) throw error
      }
      setShowModal(false)
      await fetchData()
      Swal.fire({
        title: editingTipo ? 'Tipo atualizado!' : 'Tipo criado!',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setFormError('Já existe um tipo com esse nome.')
      } else {
        setFormError(err.message || 'Erro ao salvar.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tipo) => {
    const { isConfirmed } = await Swal.fire({
      title: `Excluir tipo "${tipo.nome}"?`,
      text: 'Será removido de todos os cargos e credenciais que o utilizam.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })
    if (!isConfirmed) return
    try {
      const { error } = await supabase.from('tipos_credencial').delete().eq('id', tipo.id)
      if (error) throw error
      await fetchData()
      Swal.fire({ title: 'Tipo excluído!', icon: 'success', timer: 2000, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message, icon: 'error' })
    }
  }

  // Agrupa por categoria para exibição
  const tiposByCategoria = tipos.reduce((acc, tipo) => {
    if (!acc[tipo.categoria]) acc[tipo.categoria] = []
    acc[tipo.categoria].push(tipo)
    return acc
  }, {})

  const filteredTiposByCategoria = searchTerm.trim()
    ? Object.entries(tiposByCategoria).reduce((acc, [cat, tiposDaCategoria]) => {
        const q = searchTerm.toLowerCase()
        const filtered = tiposDaCategoria.filter(t =>
          t.nome.toLowerCase().includes(q) || cat.toLowerCase().includes(q)
        )
        if (filtered.length > 0) acc[cat] = filtered
        return acc
      }, {})
    : tiposByCategoria

  // Categorias já existentes no banco (para sugestão no datalist)
  const categoriasExistentes = [...new Set([
    ...CATEGORIAS_PADRAO,
    ...tipos.map(t => t.categoria),
  ])]

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-ea-surface">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas Super Admins têm acesso a esta área.</p>
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-ea-dark mb-1">Tipos de Credencial</h1>
              <p className="text-gray-600">Gerencie a taxonomia de tipos disponíveis no sistema.</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Tipo</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ea-primary" />
            </div>
          ) : tipos.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Nenhum tipo cadastrado</p>
              <p className="text-gray-500 text-sm">Crie tipos de credencial para organizar o sistema.</p>
            </div>
          ) : (
            <>
              {/* Campo de busca */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar tipos ou categorias..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-ea-primary focus:border-transparent shadow-sm"
                />
              </div>

              {Object.entries(filteredTiposByCategoria).length === 0 ? (
                <div className="bg-white rounded-lg shadow p-10 text-center">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhum tipo encontrado para "{searchTerm}".</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(filteredTiposByCategoria).map(([categoria, tiposDaCategoria]) => (
                    <div key={categoria} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-700">{categoria}</h2>
                        <span className="text-xs text-gray-400">{tiposDaCategoria.length} tipo{tiposDaCategoria.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {tiposDaCategoria.map(tipo => (
                          <div
                            key={tipo.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900">{tipo.nome}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEdit(tipo)}
                                className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                                title="Editar tipo"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tipo)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Excluir tipo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal: Criar / Editar Tipo de Credencial */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTipo ? 'Editar Tipo de Credencial' : 'Novo Tipo de Credencial'}
        footer={
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="tipo-form"
              disabled={saving}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-6 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <form id="tipo-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Ex: Hospedagem, Instagram, Google Ads"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <input
              type="text"
              list="categorias-list"
              required
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Selecione ou escreva uma categoria"
            />
            <datalist id="categorias-list">
              {categoriasExistentes.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-400">
              Escolha uma categoria existente ou escreva uma nova.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  )
}
