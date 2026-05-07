import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { LeadActivity } from '@/lib/types'

export async function logActivity(
  leadId: string,
  activityType: string,
  notes: string,
  performedBy: string
) {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: activityType,
    notes,
    performed_by: performedBy,
    activity_date: new Date().toISOString(),
  })
  return { error }
}

export async function fetchActivities(leadId: string) {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('lead_activities')
    .select('activity_id,lead_id,activity_type,notes,activity_date,performed_by')
    .eq('lead_id', leadId)
    .order('activity_date', { ascending: false })
  return { activities: (data as LeadActivity[]) ?? [], error }
}
