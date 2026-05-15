import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/types'
import { logActivity } from './activities'

export const LEADS_PAGE_SIZE = 50

// Only confirmed DB columns — do not add columns without verifying they exist in CLAUDE.md schema
const LIST_COLUMNS = [
  'lead_id', 'contact_name', 'account', 'email', 'phone',
  'stage', 'category', 'score', 'hiring_signal',
  'lead_owner_email', 'lead_owner_name',
  'client_relationship', 'company_type', 'lead_source',
  'industry', 'created_at', 'last_updated', 'next_followup_date', 'notes',
  // needed for email blocking checks in the table
  'unsubscribed', 'bounce_status', 'complaint_status', 'email_opt_in_status',
  'is_daily_recommended',
].join(',')

const STATS_COLUMNS = [
  'lead_id', 'contact_name', 'account', 'stage', 'score',
  'hiring_signal', 'lead_owner_email', 'next_followup_date', 'is_daily_recommended',
].join(',')

// Allowlist for server-side sort to prevent query injection
const ALLOWED_SORT_COLUMNS = new Set([
  'created_at', 'score', 'next_followup_date', 'last_updated', 'contact_name', 'account',
])

export interface FetchLeadsOptions {
  page?: number
  pageSize?: number
  search?: string
  stage?: string
  category?: string
  ownerEmail?: string
  /** true = actively hiring, false = not/unknown, undefined = no filter */
  hiringActive?: boolean
  /** Filter by exact hiring_signal value */
  hiringSignal?: string
  /** Filter by exact company_type value */
  companyType?: string
  /** Filter by exact client_relationship value */
  clientRelationship?: string
  /** Filter by exact lead_source value */
  leadSource?: string
  /** Score filter: '80plus' | '90plus' | '100' | '1to79' | '0' */
  scoreFilter?: string
  /** Follow-up date filter: 'today' | 'overdue' | 'upcoming' | 'none' */
  followupFilter?: string
  /** true = only leads where is_daily_recommended = true */
  isRecommended?: boolean
  /** true = only leads where next_followup_date <= today */
  followupDue?: boolean
  roleFilter?: { role: 'admin' | 'sales'; email: string }
  sortBy?: string
  sortAscending?: boolean
}

const ACTIVE_HIRING_VALUES = [
  'active_contract_hiring',
  'active_fulltime_hiring',
  'active_hiring',
  'weak_hiring',
  'Yes', // legacy
] as const

export async function fetchLeads(opts: FetchLeadsOptions = {}) {
  const supabase = getSupabaseBrowserClient()
  const {
    page = 0,
    pageSize = LEADS_PAGE_SIZE,
    search, stage, category, ownerEmail, hiringActive,
    hiringSignal, companyType, clientRelationship, leadSource,
    scoreFilter, followupFilter,
    isRecommended, followupDue,
    roleFilter,
    sortBy = 'created_at', sortAscending = false,
  } = opts

  const safeSortBy = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : 'created_at'

  let query = supabase
    .from('leads')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order(safeSortBy, { ascending: sortAscending })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (roleFilter?.role === 'sales') {
    query = query.eq('lead_owner_email', roleFilter.email)
  }

  if (stage) query = query.eq('stage', stage)
  if (category) query = query.eq('category', category)
  if (ownerEmail) query = query.eq('lead_owner_email', ownerEmail)
  if (hiringSignal) query = query.eq('hiring_signal', hiringSignal)
  if (companyType) query = query.eq('company_type', companyType)
  if (clientRelationship) query = query.eq('client_relationship', clientRelationship)
  if (leadSource) query = query.eq('lead_source', leadSource)
  if (scoreFilter) {
    if (scoreFilter === '80plus') query = query.gte('score', 80)
    else if (scoreFilter === '90plus') query = query.gte('score', 90)
    else if (scoreFilter === '100') query = query.eq('score', 100)
    else if (scoreFilter === '1to79') query = query.gte('score', 1).lte('score', 79)
    else if (scoreFilter === '0') query = query.or('score.is.null,score.eq.0')
  }
  if (followupFilter) {
    const today = new Date().toISOString().slice(0, 10)
    if (followupFilter === 'today') query = query.eq('next_followup_date', today)
    else if (followupFilter === 'overdue') query = query.lt('next_followup_date', today).not('next_followup_date', 'is', null)
    else if (followupFilter === 'upcoming') query = query.gt('next_followup_date', today)
    else if (followupFilter === 'none') query = query.is('next_followup_date', null)
  }
  if (isRecommended === true) query = query.eq('is_daily_recommended', true)
  if (followupDue === true) {
    const today = new Date().toISOString().slice(0, 10)
    query = query.lte('next_followup_date', today).not('next_followup_date', 'is', null)
  }
  if (hiringActive === true) {
    query = query.in('hiring_signal', [...ACTIVE_HIRING_VALUES])
  } else if (hiringActive === false) {
    query = query.not('hiring_signal', 'in', `(${ACTIVE_HIRING_VALUES.join(',')})`)
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
  hotLeads: number
  followupsDue: number
  avgScore: number
  recentLeads: Lead[]
  recommendedLeads: Lead[]
  followupLeads: Lead[]
}

export async function fetchLeadStats(ownerEmail?: string): Promise<LeadStatsResult> {
  const supabase = getSupabaseBrowserClient()

  let query = supabase
    .from('leads')
    .select(STATS_COLUMNS)
    .order('created_at', { ascending: false })

  if (ownerEmail) query = query.eq('lead_owner_email', ownerEmail)

  const { data } = await query
  const leads = (data as Lead[]) ?? []
  const scores = leads.filter((l) => l.score !== null).map((l) => l.score as number)
  const today = new Date().toISOString().slice(0, 10)

  const followupLeads = leads
    .filter((l) => l.next_followup_date && l.next_followup_date <= today)
    .slice(0, 8)

  const recommendedLeads = leads
    .filter((l) => l.is_daily_recommended)
    .slice(0, 8)

  return {
    total: leads.length,
    recommended: leads.filter((l) => l.stage === 'recommended').length,
    contacted: leads.filter((l) => l.stage === 'contacted').length,
    replied: leads.filter((l) => l.stage === 'replied').length,
    interested: leads.filter((l) => l.stage === 'interested').length,
    doNotContact: leads.filter((l) => l.stage === 'do_not_contact').length,
    hotLeads: leads.filter((l) => l.score !== null && (l.score as number) >= 70).length,
    followupsDue: leads.filter((l) => l.next_followup_date && l.next_followup_date <= today).length,
    avgScore: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0,
    recentLeads: leads.slice(0, 8),
    recommendedLeads,
    followupLeads,
  }
}

export async function updateLeadNotes(leadId: string, notes: string, updatedBy: string) {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from('leads')
    .update({ notes, last_updated: new Date().toISOString() })
    .eq('lead_id', leadId)
  if (!error) {
    await logActivity(leadId, 'note_added', 'Notes updated', updatedBy)
  }
  return { error }
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
