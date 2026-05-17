import { NextRequest, NextResponse } from 'next/server'
import { forwardToN8n, webhookNotConfigured } from '@/lib/server/n8n'

export async function POST(req: NextRequest) {
  const url = process.env.N8N_CSV_IMPORT_WEBHOOK_URL
  if (!url) return webhookNotConfigured('CSV import')

  let body: { records?: unknown; lead_ids?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  console.log('[n8n lead import]', {
    records: Array.isArray(body.records) ? body.records.length : null,
    leadIds: Array.isArray(body.lead_ids) ? body.lead_ids.length : null,
    path: new URL(url).pathname,
  })

  const result = await forwardToN8n(url, body, { timeoutMs: 60_000 })

  if (!result.ok) {
    // Pass through n8n's actual status so the client can show accurate diagnostics
    // (e.g. 404 from /webhook-test means the listener was consumed and needs re-arming).
    return NextResponse.json(
      {
        error: `CSV import webhook returned ${result.status || 'no response'}.`,
        upstream_status: result.status,
      },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 }
    )
  }

  return NextResponse.json({ success: true, data: result.data })
}
