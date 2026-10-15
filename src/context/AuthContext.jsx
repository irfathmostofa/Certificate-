import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { local } from '../lib/storage.js'

const AuthContext = createContext(null)

const DEMO_SESSION_KEY = 'session'
export const DEMO_CREDENTIALS = { email: 'admin@certify.studio', password: 'admin123' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null)
      })
      return () => {
        active = false
        sub.subscription.unsubscribe()
      }
    }
    setUser(local.get(DEMO_SESSION_KEY))
    setLoading(false)
    return () => {
      active = false
    }
  }, [])

  async function signIn(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      return data.user
    }
    if (!email || !password || password.length < 4) {
      throw new Error('Enter an email and a password of at least 4 characters.')
    }
    const session = { email, name: email.split('@')[0], demo: true }
    local.set(DEMO_SESSION_KEY, session)
    setUser(session)
    return session
  }

  async function signOut() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    } else {
      local.remove(DEMO_SESSION_KEY)
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isSupabase: isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
