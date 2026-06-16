import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

const SESSION_KEY = 'ea_login_at'
const SESSION_MAX_MS = 8 * 60 * 60 * 1000 // 8 horas

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const forceSignOut = async () => {
    localStorage.removeItem(SESSION_KEY)
    await supabase.auth.signOut()
    setUserProfile(null)
  }

  useEffect(() => {
    // Verifica expiração de sessão ao montar e a cada 5 minutos
    const checkExpiry = () => {
      const loginAt = localStorage.getItem(SESSION_KEY)
      if (loginAt && Date.now() - parseInt(loginAt) > SESSION_MAX_MS) {
        forceSignOut()
      }
    }

    checkExpiry()
    const interval = setInterval(checkExpiry, 5 * 60 * 1000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) throw error

    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'básico',
          status: 'pending',
        }])

      if (profileError) throw profileError
    }

    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    if (data.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profile?.status === 'pending') {
        await supabase.auth.signOut()
        throw new Error('Sua conta está aguardando aprovação. Você receberá um e-mail quando for aprovado.')
      }

      if (profile?.status === 'rejected') {
        await supabase.auth.signOut()
        throw new Error('Seu acesso foi negado. Entre em contato com o administrador.')
      }

      localStorage.setItem(SESSION_KEY, Date.now().toString())
      setUserProfile(profile)
      setLoading(false)
    }

    return data
  }

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY)
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUserProfile(null)
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })
    if (error) throw error
  }

  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error
  }

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateUserRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
