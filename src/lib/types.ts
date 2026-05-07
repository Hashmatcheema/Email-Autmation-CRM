export type UserRole = 'admin' | 'sales'

export interface UserProfile {
  user_id: string
  email: string
  role: UserRole
  name: string | null
  created_at: string
}

export interface Lead {
  lead_id: string
  contact_name: string | null
  account: string | null
  email: string | null
  phone: string | null
  stage: string | null
  category: string | null
  score: number | null
  hiring_signal: string | null
  lead_owner_email: string | null
  notes: string | null
  created_at: string
  last_updated?: string | null
  client_relationship?: string | null
  industry?: string | null
  company_domain?: string | null
  company_type?: string | null
  size?: string | null
  lead_source?: string | null
  lead_owner_name?: string | null
  hiring_signal_details?: string | null
  next_followup_date?: string | null
  last_communication?: string | null
  campaign_status?: string | null
  bounce_status?: string | null
  complaint_status?: string | null
  email_opt_in_status?: boolean | null
  unsubscribed?: boolean | null
  is_daily_recommended?: boolean | null
  created_by_email?: string | null
  created_by_name?: string | null
}

export interface LeadActivity {
  activity_id: string
  lead_id: string
  activity_type: string
  notes: string | null
  activity_date: string
  performed_by: string | null
}

export interface EmailTemplate {
  template_id: string
  template_name: string
  template_type: string | null
  subject: string
  body: string
  is_active: boolean | null
  created_at?: string
  created_by_email?: string | null
}

export const LEAD_STAGES = [
  'new',
  'recommended',
  'contacted',
  'follow_up',
  'replied',
  'interested',
  'not_interested',
  'do_not_contact',
  'closed_won',
  'closed_lost',
] as const

export type LeadStage = (typeof LEAD_STAGES)[number]

export const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  recommended: 'Recommended',
  contacted: 'Contacted',
  follow_up: 'Follow Up',
  replied: 'Replied',
  interested: 'Interested',
  not_interested: 'Not Interested',
  do_not_contact: 'Do Not Contact',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  recommended: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  follow_up: 'bg-amber-50 text-amber-700 border-amber-200',
  replied: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  interested: 'bg-green-50 text-green-700 border-green-200',
  not_interested: 'bg-rose-50 text-rose-700 border-rose-200',
  do_not_contact: 'bg-red-50 text-red-700 border-red-200',
  closed_won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed_lost: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const TEMPLATE_TYPES = [
  'initial_outreach',
  'follow_up_1',
  'follow_up_2',
  'follow_up_3',
  'campaign',
] as const

export type TemplateType = (typeof TEMPLATE_TYPES)[number]

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  initial_outreach: 'Initial Outreach',
  follow_up_1: 'Follow Up 1',
  follow_up_2: 'Follow Up 2',
  follow_up_3: 'Follow Up 3',
  campaign: 'Campaign',
}

export const COMPANY_TYPE_OPTIONS = [
  'Startup',
  'SMB',
  'Mid-Market',
  'Enterprise',
  'Agency',
  'Non-Profit',
  'Government',
  'Other',
]

export const CLIENT_RELATIONSHIP_OPTIONS = [
  'Cold',
  'Warm',
  'Existing Client',
  'Former Client',
  'Referral',
  'Partner',
]

export const LEAD_SOURCE_OPTIONS = [
  'Apollo',
  'LinkedIn',
  'Oorwin',
  'Referral',
  'Website',
  'Cold Outreach',
  'Event',
  'Apify',
  'Manual',
  'Other',
]
