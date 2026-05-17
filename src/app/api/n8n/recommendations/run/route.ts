import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { forwardToN8n, webhookNotConfigured, webhookFailed } from '@/lib/server/n8n'

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('email', user.email)
    .single()

  const role = (profile as { role?: string } | null)?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }

  const url = process.env.N8N_DAILY_RECOMMENDATIONS_WEBHOOK_URL
  if (!url) return webhookNotConfigured('Daily recommendations')

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const payload = {
    triggered_by_email: user.email,
    triggered_at: new Date().toISOString(),
    ...(typeof body === 'object' && body !== null ? body : {}),
  }

  const result = await forwardToN8n(url, payload, { timeoutMs: 60_000 })
  if (!result.ok) return webhookFailed('Daily recommendations', result.status)

  return NextResponse.json({ success: true, data: result.data })
}
