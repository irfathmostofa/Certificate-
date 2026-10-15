import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasPlaceholder =
  !url ||
  !anonKey ||
  url.includes('your-supabase-project-url') ||
  anonKey.includes('your-supabase-anon-key')

export const isSupabaseConfigured = !hasPlaceholder

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null

export const SIGNATURE_BUCKET = 'certify-assets'
