import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Modal from '../components/Modal'
import { Briefcase, Plus, Pencil, Trash2, AlertCircle, Save, Search } from 'lucide-react'
import Swal from 'sweetalert2'

export default function Cargos() {
  const { userProfile } = useAuth()
  const isSuperAdmin = userProfile?.role === 'super_admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [cargos, setCargos] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingCargo, setEditingCargo] = useState(null)
  const [form, setForm] = useState({ nome: '' })
  const [selectedTipos, setSelectedTipos] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [searchTipo, setSearchTipo] = useState('')

  useEffect(() => {
    if (isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: cargosData, error: e1 }, { data: tiposData, error: e2 }] = await Promise.all([
        supabase
          .from('cargos')
          .select('id, nome, created_at, cargo_tipo_credencial(tipo_credencial_id)')
          .order('nome'),
        supabase
          .from('tipos_credencial')
          .select('id, nome, categoria')
          .order('categoria, nome'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setCargos(cargosData || [])
      setTipos(tiposData || [])
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message, icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingCargo(null)
    setForm({ nome: '' })
    setSelectedTipos(new Set())
    setFormError('')
    setSearchTipo('')
    setShowModal(true)
  }

  const openEdit = (cargo) => {
    setEditingCargo(cargo)
    setForm({ nome: cargo.nome })
    setSelectedTipos(new Set(cargo.cargo_tipo_credencial.map(r => r.tipo_credencial_id)))
    setFormError('')
    setSearchTipo('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const nome = form.nome.trim()
    if (!nome) { setFormError('O nome é obrigatório.'); return }
    setSaving(true)
    setFormError('')
    try {
      let cargoId
      if (editingCargo) {
        const { error } = await supabase.from('cargos').update({ nome }).eq('id', editingCargo.id)
        if (error) throw error
        cargoId = editingCargo.id
      } else {
        const { data, error } = await supabase.from('cargos').insert([{ nome }]).select('id').single()
        if (error) throw error
        cargoId = data.id
      }

      // Sincroniza tipos vinculados: deleta todos e reinsere os selecionados
      const { error: delError } = await supabase
        .from('cargo_tipo_credencial')
        .delete()
        .eq('cargo_id', cargoId)
      if (delError) throw delError

      if (selectedTipos.size > 0) {
        const rows = Array.from(selectedTipos).map(tipoId => ({
          cargo_id: cargoId,
          tipo_credencial_id: tipoId,
        }))
        const { error: insError } = await supabase.from('cargo_tipo_credencial').insert(rows)
        if (insError) throw insError
      }

      setShowModal(false)
      await fetchData()
      Swal.fire({
        title: editingCargo ? 'Cargo atualizado!' : 'Cargo criado!',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar o cargo.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cargo) => {
    const { isConfirmed } = await Swal.fire({
      title: `Excluir cargo "${cargo.nome}"?`,
      text: 'Esta ação não pode ser desfeita. Usuários com este cargo ficarão sem cargo atribuído.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })
    if (!isConfirmed) return
    try {
      const { error } = await supabase.from('cargos').delete().eq('id', cargo.id)
      if (error) throw error
      await fetchData()
      Swal.fire({ title: 'Cargo excluído!', icon: 'success', timer: 2000, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ title: 'Erro', text: err.message, icon: 'error' })
    }
  }

  const toggleTipo = (tipoId) => {
    setSelectedTipos(prev => {
      const next = new Set(prev)
      if (next.has(tipoId)) { next.delete(tipoId) } else { next.add(tipoId) }
      return next
    })
  }

  const toggleCategoria = (tiposDaCategoria) => {
    const ids = tiposDaCategoria.map(t => t.id)
    const allSelected = ids.every(id => selectedTipos.has(id))
    setSelectedTipos(prev => {
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  const tiposByCategoria = tipos.reduce((acc, tipo) => {
    if (!acc[tipo.categoria]) acc[tipo.categoria] = []
    acc[tipo.categoria].push(tipo)
    return acc
  }, {})

  const filteredTiposByCategoria = searchTipo.trim()
    ? Object.entries(tiposByCategoria).reduce((acc, [cat, tiposDaCategoria]) => {
        const q = searchTipo.toLowerCase()
        const filtered = tiposDaCategoria.filter(t => t.nome.toLowerCase().includes(q))
        if (filtered.length > 0) acc[cat] = filtered
        return acc
      }, {})
    : tiposByCategoria

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
              <h1 className="text-3xl font-bold text-ea-dark mb-1">Cargos</h1>
              <p className="text-gray-600">Defina quais tipos de credencial cada cargo pode visualizar.</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Cargo</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ea-primary" />
            </div>
          ) : cargos.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Nenhum cargo cadastrado</p>
              <p className="text-gray-500 text-sm">Crie o primeiro cargo para definir permissões de visualização.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipos de Credencial Visíveis</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cargos.map((cargo) => (
                      <tr key={cargo.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 w-48">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-ea-accent flex-shrink-0" />
                            <span className="font-medium text-gray-900">{cargo.nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {cargo.cargo_tipo_credencial.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">Nenhum tipo vinculado</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {cargo.cargo_tipo_credencial.slice(0, 6).map(r => {
                                const tipo = tipos.find(t => t.id === r.tipo_credencial_id)
                                return tipo ? (
                                  <span
                                    key={r.tipo_credencial_id}
                                    className="px-2 py-0.5 text-xs bg-ea-surface text-ea-primary rounded-full border border-ea-border"
                                  >
                                    {tipo.nome}
                                  </span>
                                ) : null
                              })}
                              {cargo.cargo_tipo_credencial.length > 6 && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                                  +{cargo.cargo_tipo_credencial.length - 6}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(cargo)}
                              className="p-1.5 text-ea-primary hover:bg-ea-surface rounded transition-colors"
                              title="Editar cargo"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(cargo)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Excluir cargo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {cargos.map((cargo) => (
                  <div key={cargo.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="w-4 h-4 text-ea-accent flex-shrink-0" />
                          <span className="font-medium text-gray-900">{cargo.nome}</span>
                        </div>
                        {cargo.cargo_tipo_credencial.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhum tipo vinculado</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {cargo.cargo_tipo_credencial.map(r => {
                              const tipo = tipos.find(t => t.id === r.tipo_credencial_id)
                              return tipo ? (
                                <span
                                  key={r.tipo_credencial_id}
                                  className="px-2 py-0.5 text-xs bg-ea-surface text-ea-primary rounded-full border border-ea-border"
                                >
                                  {tipo.nome}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(cargo)}
                          className="p-1.5 text-ea-primary hover:bg-ea-surface rounded"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cargo)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Criar / Editar Cargo */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSearchTipo('') }}
        title={editingCargo ? `Editar Cargo — ${editingCargo.nome}` : 'Novo Cargo'}
        footer={
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setShowModal(false); setSearchTipo('') }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="cargo-form"
              disabled={saving}
              className="flex items-center gap-2 bg-ea-accent text-white font-semibold px-6 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <form id="cargo-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cargo *</label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
              placeholder="Ex: Desenvolvedor, Redes Sociais, Tráfego Pago"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipos de Credencial Visíveis
              <span className="ml-2 text-xs text-gray-400 font-normal">
                ({selectedTipos.size} selecionado{selectedTipos.size !== 1 ? 's' : ''})
              </span>
            </label>
            {tipos.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                Nenhum tipo de credencial cadastrado ainda.{' '}
                <span className="text-ea-accent">Crie tipos em Tipos de Credencial primeiro.</span>
              </p>
            ) : (
              <>
                {/* Campo de busca */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTipo}
                    onChange={e => setSearchTipo(e.target.value)}
                    placeholder="Buscar tipos..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
                  />
                </div>

                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {Object.entries(filteredTiposByCategoria).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum tipo encontrado.</p>
                  ) : (
                    Object.entries(filteredTiposByCategoria).map(([categoria, tiposDaCategoria]) => {
                      const allSelected  = tiposDaCategoria.every(t => selectedTipos.has(t.id))
                      const someSelected = tiposDaCategoria.some(t => selectedTipos.has(t.id))
                      return (
                        <div key={categoria}>
                          {/* Linha da categoria — checkbox pai */}
                          <label className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer sticky top-0 z-10">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                              onChange={() => toggleCategoria(tiposDaCategoria)}
                              className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                            />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              {categoria}
                            </span>
                            <span className="ml-auto text-xs text-gray-400 font-normal normal-case">
                              {tiposDaCategoria.filter(t => selectedTipos.has(t.id)).length}/{tiposDaCategoria.length}
                            </span>
                          </label>
                          {/* Filhos */}
                          {tiposDaCategoria.map(tipo => (
                            <label
                              key={tipo.id}
                              className="flex items-center gap-3 pl-10 pr-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTipos.has(tipo.id)}
                                onChange={() => toggleTipo(tipo.id)}
                                className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                              />
                              <span className="text-sm text-gray-800">{tipo.nome}</span>
                            </label>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
