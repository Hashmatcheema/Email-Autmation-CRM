import { NextResponse } from 'next/server'

const DEFAULT_TIMEOUT_MS = 20_000

export interface ForwardResult {
  ok: boolean
  status: number
  data: unknown
}

/**
 * Forward a JSON payload to an n8n webhook URL.
 * Attaches X-CRM-Secret header when N8N_CRM_SECRET is set.
 * Returns the parsed response when possible. Raw errors go to server logs only.
 */
export async function forwardToN8n(
  webhookUrl: string,
  body: unknown,
  opts: { timeoutMs?: number } = {}
): Promise<ForwardResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = process.env.N8N_CRM_SECRET
  if (secret) headers['X-CRM-Secret'] = secret

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })

    const ct = res.headers.get('content-type') ?? ''
    let data: unknown = null
    try {
      data = ct.includes('application/json') ? await res.json() : await res.text()
    } catch {
      data = null
    }

    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    console.error('[n8n] forward failed', { webhookUrl, err })
    return { ok: false, status: 0, data: null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Standard JSON response when a webhook URL env var is not configured.
 * Keep the user-facing message friendly; never leak the env var name.
 */
export function webhookNotConfigured(label: string) {
  return NextResponse.json(
    { error: `${label} automation is not configured yet.` },
    { status: 503 }
  )
}

/**
 * Standard JSON response when the upstream webhook returns a non-OK status.
 */
export function webhookFailed(label: string, status: number) {
  return NextResponse.json(
    { error: `${label} webhook returned ${status || 'no response'}.` },
    { status: status >= 400 && status < 600 ? 502 : 502 }
  )
}

/**
 * Read the configured send-email webhook URL, supporting both the new
 * standard name and the legacy back-compat name.
 */
export function getSendEmailWebhookUrl(): string | undefined {
  return process.env.N8N_EMAIL_SEND_WEBHOOK_URL || process.env.N8N_SEND_EMAIL_WEBHOOK
}
