import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BEATOVEN_API_KEY = process.env.BEATOVEN_API_KEY
const BEATOVEN_API_BASE_URL = 'https://public-api.beatoven.ai'

// ステータス確認
export async function GET(request: NextRequest) {
  try {
    if (!BEATOVEN_API_KEY) {
      return NextResponse.json(
        { error: 'Beatoven API key not configured' },
        { status: 500 }
      )
    }

    const taskId = request.nextUrl.searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    // Beatoven.aiにステータス確認
    const response = await fetch(`${BEATOVEN_API_BASE_URL}/api/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEATOVEN_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Beatoven status check error:', errorText)
      return NextResponse.json(
        { error: `Beatoven API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const status = data.status || 'unknown'

    // 完了時は音源URLを返す
    if (status === 'composed') {
      const trackUrl = data.meta?.track_url || data.track_url
      return NextResponse.json({
        status: 'completed',
        trackUrl,
      })
    }

    // 進行中
    return NextResponse.json({
      status: status === 'running' ? 'composing' : status,
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
