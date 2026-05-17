import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Admin-only user management.
 *
 * Service role is required to create / delete Supabase Auth users. We keep
 * the key strictly server-side and verify the caller is an admin before
 * doing anything privileged.
 */

interface CreateBody {
  email?: string
  password?: string
  name?: string
  role?: 'admin' | 'sales'
  is_active?: boolean
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('email', user.email)
    .single()
  if (!profile || (profile as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }
  return { email: user.email }
}

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck instanceof NextResponse) return adminCheck

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'User creation requires SUPABASE_SERVICE_ROLE_KEY on the server. Ask the project admin to configure it.' },
      { status: 503 },
    )
  }

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const name = body.name?.trim() || null
  const role: 'admin' | 'sales' = body.role === 'admin' ? 'admin' : 'sales'
  const isActive = body.is_active !== false

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? undefined, role },
  })
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Failed to create auth user' },
      { status: 400 },
    )
  }

  const profilePayload = {
    user_id: created.user.id,
    email,
    name,
    role,
    is_active: isActive,
  }
  const { error: profileErr } = await service.from('user_profiles').insert(profilePayload)
  if (profileErr) {
    // Roll back the auth user so the two tables stay consistent.
    await service.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json(
      { error: `Auth user created but profile insert failed: ${profileErr.message}. Auth user was rolled back.` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, user: profilePayload })
}

interface DeleteBody {
  user_id?: string
}

export async function DELETE(req: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck instanceof NextResponse) return adminCheck

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'User deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.' },
      { status: 503 },
    )
  }

  let body: DeleteBody
  try {
    body = (await req.json()) as DeleteBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const userId = body.user_id?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  // Lookup target user
  const { data: targetRaw } = await service
    .from('user_profiles')
    .select('user_id,email,role')
    .eq('user_id', userId)
    .single()
  const target = targetRaw as { user_id: string; email: string; role: string } | null

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (target.email.toLowerCase() === adminCheck.email.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  // Prevent deleting the last active admin
  if (target.role === 'admin') {
    const { count } = await service
      .from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .neq('is_active', false)
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last active admin' },
        { status: 400 },
      )
    }
  }

  // Check if user owns leads — surface a warning but allow if owns_leads_ack=true.
  // The UI is expected to confirm with the admin before resending the request.
  const { count: leadsCount } = await service
    .from('leads')
    .select('lead_id', { count: 'exact', head: true })
    .eq('lead_owner_email', target.email)
  if ((leadsCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `This user owns ${leadsCount} lead(s). Reassign them before deletion.`,
        leads_owned: leadsCount,
      },
      { status: 409 },
    )
  }

  const { error: profileDelErr } = await service.from('user_profiles').delete().eq('user_id', userId)
  if (profileDelErr) {
    return NextResponse.json({ error: `Profile delete failed: ${profileDelErr.message}` }, { status: 500 })
  }

  const { error: authDelErr } = await service.auth.admin.deleteUser(userId)
  if (authDelErr) {
    // Profile is gone but auth row remains — surface to admin so they can clean up.
    return NextResponse.json(
      { error: `Profile deleted, but auth user deletion failed: ${authDelErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
