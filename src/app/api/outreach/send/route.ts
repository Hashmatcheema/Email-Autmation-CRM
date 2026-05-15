import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_SEND_EMAIL_WEBHOOK
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Email automation webhook is not configured yet.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Webhook returned ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reach webhook' }, { status: 502 })
  }
}
