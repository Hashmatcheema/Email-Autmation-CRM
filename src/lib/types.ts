export type UserRole = 'admin' | 'sales'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface Lead {
  id: string
  contact_name: string | null
  account: string | null
  email: string | null
  phone: string | null
  stage: string | null
  category: string | null
  score: number | null
  hiring_signal: boolean | null
  lead_owner_email: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: string
  description: string | null
  created_at: string
  created_by: string | null
}

export interface EmailTemplate {
  id: string
  template_name: string
  template_type: string | null
  subject: string
  body: string
  active: boolean | null
  created_at: string
  created_by: string | null
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
