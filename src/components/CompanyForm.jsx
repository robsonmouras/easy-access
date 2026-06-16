import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { supabase } from '../lib/supabase'
import { Save, Users } from 'lucide-react'
import Modal from './Modal'

const CompanyForm = ({ company, onClose }) => {
  const { userProfile } = useAuth()
  const { createCompany, updateCompany } = useCompany()
  const isEditing = !!company

  const [name, setName] = useState(company?.name || '')
  const [description, setDescription] = useState(company?.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [loadingUsers, setLoadingUsers] = useState(true)
  const [customAccessUsers, setCustomAccessUsers] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [originalUserIds, setOriginalUserIds] = useState(new Set())

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true)
      try {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('custom_access_enabled', true)
          .eq('status', 'active')
          .order('full_name')

        setCustomAccessUsers(users || [])

        if (isEditing && users && users.length > 0) {
          const { data: existing } = await supabase
            .from('user_company_access')
            .select('user_id')
            .eq('company_id', company.id)

          const ids = new Set((existing || []).map(r => r.user_id))
          setSelectedUserIds(ids)
          setOriginalUserIds(new Set(ids))
        }
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [isEditing, company?.id])

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      let companyId
      if (isEditing) {
        await updateCompany(company.id, { name, description: description || null })
        companyId = company.id
      } else {
        const created = await createCompany({ name, description: description || null })
        companyId = created.id
      }

      if (isEditing) {
        const toAdd = [...selectedUserIds].filter(id => !originalUserIds.has(id))
        const toRemove = [...originalUserIds].filter(id => !selectedUserIds.has(id))

        if (toRemove.length > 0) {
          await supabase
            .from('user_company_access')
            .delete()
            .eq('company_id', companyId)
            .in('user_id', toRemove)
        }
        if (toAdd.length > 0) {
          await supabase.from('user_company_access').insert(
            toAdd.map(userId => ({ user_id: userId, company_id: companyId, granted_by: userProfile?.id || null }))
          )
        }
      } else {
        if (selectedUserIds.size > 0) {
          await supabase.from('user_company_access').insert(
            [...selectedUserIds].map(userId => ({ user_id: userId, company_id: companyId, granted_by: userProfile?.id || null }))
          )
        }
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar empresa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={isEditing ? 'Editar Empresa' : 'Nova Empresa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome da Empresa *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
            placeholder="Ex: Easy Access"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ea-primary focus:border-transparent"
            placeholder="Descrição opcional da empresa"
          />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Quem pode ver
            </p>
            {!loadingUsers && customAccessUsers.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set(customAccessUsers.map(u => u.id)))}
                  className="text-ea-primary hover:underline"
                >
                  Todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="text-ea-primary hover:underline"
                >
                  Nenhum
                </button>
              </div>
            )}
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ea-primary" />
            </div>
          ) : customAccessUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
              Nenhum usuário com acesso personalizado ativo
            </p>
          ) : (
            <>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {customAccessUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 text-ea-primary rounded border-gray-300 focus:ring-ea-primary flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {selectedUserIds.size} de {customAccessUsers.length} usuário{customAccessUsers.length !== 1 ? 's' : ''} {selectedUserIds.size !== 1 ? 'selecionados' : 'selecionado'}
              </p>
            </>
          )}
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
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-ea-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-ea-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default CompanyForm
