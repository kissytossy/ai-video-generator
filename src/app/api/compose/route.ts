import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BEATOVEN_API_KEY = process.env.BEATOVEN_API_KEY
const BEATOVEN_API_BASE_URL = 'https://public-api.beatoven.ai'

interface ComposeRequest {
  prompt: string
  duration: number  // 秒
  genre?: string
  mood?: string
  tempo?: 'slow' | 'medium' | 'fast'
}

// 作曲をリクエスト
export async function POST(request: NextRequest) {
  try {
    if (!BEATOVEN_API_KEY) {
      return NextResponse.json(
        { error: 'Beatoven API key not configured' },
        { status: 500 }
      )
    }

    const body: ComposeRequest = await request.json()
    const { prompt, duration, genre, mood, tempo } = body

    if (!prompt || !duration) {
      return NextResponse.json(
        { error: 'prompt and duration are required' },
        { status: 400 }
      )
    }

    // Beatoven.aiに作曲リクエスト
    const response = await fetch(`${BEATOVEN_API_BASE_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEATOVEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        duration: Math.ceil(duration),  // 秒（整数）
        format: 'mp3',
        // オプション
        ...(genre && { genre }),
        ...(mood && { mood }),
        ...(tempo && { tempo }),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Beatoven API error:', errorText)
      return NextResponse.json(
        { error: `Beatoven API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      taskId: data.task_id || data.id,
      status: 'started',
    })

  } catch (error) {
    console.error('Compose error:', error)
    return NextResponse.json(
      { error: 'Failed to start composition' },
      { status: 500 }
    )
  }
}