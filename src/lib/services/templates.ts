import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { EmailTemplate } from '@/lib/types'

const LIST_COLUMNS = 'template_id,template_name,template_type,subject,is_active'

export async function fetchTemplates() {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select(LIST_COLUMNS)
    .order('template_name', { ascending: true })
  return { templates: (data as EmailTemplate[]) ?? [], error }
}

export async function fetchActiveTemplates() {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('template_id,template_name,template_type,subject,body,is_active')
    .eq('is_active', true)
    .order('template_name', { ascending: true })
  return { templates: (data as EmailTemplate[]) ?? [], error }
}
