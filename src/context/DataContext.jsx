import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import {
  getSettings,
  saveSettings,
  listCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  listCertificates,
  createCertificates,
  deleteCertificate,
  allTemplates
} from '../lib/data.js'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [customTemplates, setCustomTemplates] = useState([])
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      const [s, t, c] = await Promise.all([
        getSettings(),
        listCustomTemplates(),
        listCertificates()
      ])
      setSettings(s)
      setCustomTemplates(t)
      setCertificates(c)
    } catch (e) {
      setError(e.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Do not query the backend while signed out (e.g. on the login screen or
    // the public verification page) — under Supabase RLS those requests would
    // be rejected and surface a spurious error. Re-load whenever the signed-in
    // user changes (e.g. after login).
    if (!user) {
      setSettings(null)
      setCustomTemplates([])
      setCertificates([])
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    refresh()
  }, [refresh, user, user?.email])

  const persistSettings = useCallback(async (next) => {
    const saved = await saveSettings(next)
    setSettings(saved)
    return saved
  }, [])

  const persistTemplate = useCallback(async (tpl) => {
    const saved = await saveCustomTemplate(tpl)
    setCustomTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = saved
        return copy
      }
      return [saved, ...prev]
    })
    return saved
  }, [])

  const removeTemplate = useCallback(async (id) => {
    await deleteCustomTemplate(id)
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addCertificates = useCallback(
    async (items) => {
      const enriched = items.map((it) => ({
        ...it,
        organization: it.organization || settings?.organization || null,
        signature: it.signature || settings?.signature || null,
        certificatePrefix: it.certificatePrefix || settings?.certificatePrefix
      }))
      const created = await createCertificates(enriched)
      setCertificates((prev) => [...created, ...prev])
      return created
    },
    [settings]
  )

  const removeCertificate = useCallback(async (id) => {
    await deleteCertificate(id)
    setCertificates((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const templates = allTemplates(customTemplates)

  function findTemplate(id) {
    return templates.find((t) => t.id === id)
  }

  return (
    <DataContext.Provider
      value={{
        settings,
        templates,
        customTemplates,
        certificates,
        loading,
        error,
        refresh,
        persistSettings,
        persistTemplate,
        removeTemplate,
        addCertificates,
        removeCertificate,
        findTemplate
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
