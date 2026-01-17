import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUNO_API_KEY = process.env.SUNO_API_KEY

export async function POST(request: NextRequest) {
  if (!SUNO_API_KEY) {
    return NextResponse.json(
      { error: 'SUNO_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const { prompt, duration, genre, mood, tempo, withLyrics } = await request.json()

    // 曲の長さを秒数で指定（動的に計算された値を使用、最低15秒）
    const targetDuration = Math.max(15, duration || 60)
    
    // sunoapi.org用のプロンプトを作成（曲の長さを含める）
    const durationText = `approximately ${targetDuration} seconds long`
    const musicPrompt = withLyrics
      ? `${mood} ${genre} music, ${tempo} tempo, catchy vocals, ${durationText}`
      : `${mood} ${genre} music, ${tempo} tempo, instrumental background music, ${durationText}`
    const style = `${genre}, ${mood}, ${tempo}`

    console.log('Suno API request:', { prompt: musicPrompt, style, withLyrics, targetDuration })

    // sunoapi.org API呼び出し
    const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customMode: true,
        instrumental: !withLyrics,
        model: 'V4_5ALL',
        prompt: musicPrompt,
        style: style,
        title: withLyrics ? 'AI Generated Song' : 'AI Generated BGM',
        duration: targetDuration,  // 曲の長さを秒数で指定
        callBackUrl: 'https://example.com/callback',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Suno API error:', errorText)
      return NextResponse.json(
        { error: `Suno API error: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('Suno API response:', data)

    if (data.code === 200 && data.data?.taskId) {
      return NextResponse.json({
        taskId: data.data.taskId,
        status: 'started',
      })
    }

    return NextResponse.json(
      { error: 'Unexpected response from Suno API', data },
      { status: 500 }
    )

  } catch (error) {
    console.error('Compose error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}