import { NextRequest, NextResponse } from 'next/server'
import { forwardToN8n, webhookNotConfigured, webhookFailed } from '@/lib/server/n8n'

export async function POST(req: NextRequest) {
  const url = process.env.N8N_EMAIL_PREPARE_WEBHOOK_URL
  if (!url) return webhookNotConfigured('Email prepare')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const result = await forwardToN8n(url, body)
  if (!result.ok) return webhookFailed('Email prepare', result.status)

  return NextResponse.json({ success: true, data: result.data })
}
