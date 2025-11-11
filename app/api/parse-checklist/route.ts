import { NextRequest, NextResponse } from 'next/server'

// Use the actual webhook URL that was being used in the code
const PARSE_WEBHOOK_URL = "https://karim.n8nkk.tech/webhook/2144abe8-5f30-4747-befe-5ac55487fe97"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    console.log('[API Proxy] Forwarding parse request to n8n webhook...')

    const response = await fetch(PARSE_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API Proxy] Parse webhook error:', response.status, errorText)
      return NextResponse.json(
        { error: `Webhook returned ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[API Proxy] Successfully received parse response from webhook')

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API Proxy] Error calling parse webhook:', error)
    return NextResponse.json(
      { error: 'Failed to call webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
