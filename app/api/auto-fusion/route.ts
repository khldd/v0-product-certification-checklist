import { NextRequest, NextResponse } from 'next/server'

const AUTO_FUSION_WEBHOOK_URL = "https://karim.n8nkk.tech/webhook/auto-fusion-batch"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[API Proxy] Forwarding auto-fusion request to n8n webhook...')

    const response = await fetch(AUTO_FUSION_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API Proxy] Webhook error:', response.status, errorText)
      return NextResponse.json(
        { error: `Webhook returned ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[API Proxy] Successfully received response from webhook')

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API Proxy] Error calling webhook:', error)
    return NextResponse.json(
      { error: 'Failed to call webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
