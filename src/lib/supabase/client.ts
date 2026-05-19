import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Guard: env vars are absent during build-time prerendering without Vercel env config.
  // Real auth calls only happen inside useEffect (browser only), so returning null here is safe.
  if (!url || !key) return null
  if (!client) {
    client = createBrowserClient(url, key)
  }
  return client
}
