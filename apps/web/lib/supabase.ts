import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (
  supabaseUrl === 'https://placeholder.supabase.co' ||
  supabaseAnonKey === 'placeholder-anon-key'
) {
  console.warn(
    '[supabase] Using placeholder credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to connect to a real project.',
  )
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
