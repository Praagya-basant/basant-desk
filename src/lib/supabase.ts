import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check your .env file.')
}

// Main client — used for the logged-in user's session throughout the app.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'core' },
})
