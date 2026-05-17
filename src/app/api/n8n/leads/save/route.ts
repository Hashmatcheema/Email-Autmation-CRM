import { NextRequest, NextResponse } from 'next/server'
import { forwardToN8n, webhookNotConfigured, webhookFailed } from '@/lib/server/n8n'

function pathOf(url: string | undefined): string {
  if (!url) return ''
  try { return new URL(url).pathname } catch { return '' }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const rawMode = typeof body.mode === 'string' ? body.mode.toLowerCase() : ''
  const hasLeadId = typeof body.lead_id === 'string' && (body.lead_id as string).length > 0

  // Route by explicit mode first; fall back to lead_id heuristic only when missing.
  let isUpdate: boolean
  let selected: 'create' | 'update' | 'save'
  if (rawMode === 'create') {
    isUpdate = false
    selected = 'create'
  } else if (rawMode === 'update' || rawMode === 'edit') {
    isUpdate = true
    selected = 'update'
  } else {
    isUpdate = hasLeadId
    selected = hasLeadId ? 'update' : 'create'
  }

  const url = isUpdate
    ? (process.env.N8N_LEAD_UPDATE_WEBHOOK_URL || process.env.N8N_LEAD_SAVE_WEBHOOK_URL)
    : (process.env.N8N_LEAD_CREATE_WEBHOOK_URL || process.env.N8N_LEAD_SAVE_WEBHOOK_URL)

  // If we fell through to the legacy save webhook, reflect that in the log.
  const usingSaveFallback =
    (isUpdate && !process.env.N8N_LEAD_UPDATE_WEBHOOK_URL && !!process.env.N8N_LEAD_SAVE_WEBHOOK_URL) ||
    (!isUpdate && !process.env.N8N_LEAD_CREATE_WEBHOOK_URL && !!process.env.N8N_LEAD_SAVE_WEBHOOK_URL)
  const logSelected: 'create' | 'update' | 'save' = usingSaveFallback ? 'save' : selected

  console.log('[n8n lead save]', {
    mode: rawMode || null,
    hasLeadId,
    selected: logSelected,
    path: pathOf(url),
  })

  if (!url) return webhookNotConfigured(isUpdate ? 'Lead update' : 'Lead create')

  const result = await forwardToN8n(url, body)
  if (!result.ok) return webhookFailed(isUpdate ? 'Lead update' : 'Lead create', result.status)

  return NextResponse.json({ success: true, data: result.data })
}
