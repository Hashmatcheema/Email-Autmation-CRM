import { NextRequest, NextResponse } from 'next/server'
import {
  forwardToN8n, webhookNotConfigured, webhookFailed, getSendEmailWebhookUrl,
} from '@/lib/server/n8n'

export async function POST(req: NextRequest) {
  const url = getSendEmailWebhookUrl()
  if (!url) return webhookNotConfigured('Email send')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const result = await forwardToN8n(url, body)
  if (!result.ok) return webhookFailed('Email send', result.status)

  return NextResponse.json({ success: true, data: result.data })
}
