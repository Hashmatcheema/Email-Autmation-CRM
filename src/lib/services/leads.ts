import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/types'
import { logActivity } from './activities'

export const LEADS_PAGE_SIZE = 50

// Only confirmed DB columns — do not add columns without verifying they exist
const LIST_COLUMNS = [
  'lead_id', 'contact_name', 'account', 'email',
  'stage', 'category', 'score', 'hiring_signal',
  'lead_owner_email', 'client_relationship', 'industry', 'created_at',
].join(',')

const STATS_COLUMNS = [
  'lead_id', 'stage', 'score', 'hiring_signal', 'lead_owner_email',
].join(',')

export interface FetchLeadsOptions {
  page?: number
  search?: string
  stage?: string
  ownerEmail?: string
  hiringSignal?: string | null
  roleFilter?: { role: 'admin' | 'sales'; email: string }
}

export async function fetchLeads(opts: FetchLeadsOptions = {}) {
  const supabase = getSupabaseBrowserClient()
  const { page = 0, search, stage, ownerEmail, hiringSignal, roleFilter } = opts

  let query = supabase
    .from('leads')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * LEADS_PAGE_SIZE, (page + 1) * LEADS_PAGE_SIZE - 1)

  if (roleFilter?.role === 'sales') {
    query = query.eq('lead_owner_email', roleFilter.email)
  }

  if (stage) query = query.eq('stage', stage)
  if (ownerEmail) query = query.eq('lead_owner_email', ownerEmail)
  if (hiringSignal !== undefined && hiringSignal !== null) {
    query = query.eq('hiring_signal', hiringSignal)
  }

  if (search && search.trim()) {
    const s = search.trim()
    query = query.or(
      `contact_name.ilike.%${s}%,account.ilike.%${s}%,email.ilike.%${s}%`
    )
  }

  const { data, error, count } = await query
  return { leads: (data as Lead[]) ?? [], count: count ?? 0, error }
}

export async function fetchLeadById(leadId: string) {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('lead_id', leadId)
    .single()
  return { lead: data as Lead | null, error }
}

export interface LeadStatsResult {
  total: number
  recommended: number
  contacted: number
  replied: number
  interested: number
  doNotContact: number
  avgScore: number
  recentLeads: Lead[]
}

export async function fetchLeadStats(ownerEmail?: string): Promise<LeadStatsResult> {
  const supabase = getSupabaseBrowserClient()

  let query = supabase
    .from('leads')
    .select(STATS_COLUMNS + ',contact_name,account,lead_id')
    .order('created_at', { ascending: false })

  if (ownerEmail) query = query.eq('lead_owner_email', ownerEmail)

  const { data } = await query
  const leads = (data as Lead[]) ?? []
  const scores = leads.filter((l) => l.score !== null).map((l) => l.score as number)

  return {
    total: leads.length,
    recommended: leads.filter((l) => l.stage === 'recommended').length,
    contacted: leads.filter((l) => l.stage === 'contacted').length,
    replied: leads.filter((l) => l.stage === 'replied').length,
    interested: leads.filter((l) => l.stage === 'interested').length,
    doNotContact: leads.filter((l) => l.stage === 'do_not_contact').length,
    avgScore: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0,
    recentLeads: leads.slice(0, 8),
  }
}

export async function updateLeadStage(
  leadId: string,
  newStage: string,
  createdBy: string
) {
  const supabase = getSupabaseBrowserClient()

  const { error } = await supabase
    .from('leads')
    .update({ stage: newStage, last_updated: new Date().toISOString() })
    .eq('lead_id', leadId)

  if (!error) {
    await logActivity(
      leadId,
      'stage_changed',
      `Stage changed to ${newStage.replace(/_/g, ' ')}`,
      createdBy
    )
  }

  return { error }
}
