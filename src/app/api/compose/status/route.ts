import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUNO_API_KEY = process.env.SUNO_API_KEY

export async function GET(request: NextRequest) {
  if (!SUNO_API_KEY) {
    return NextResponse.json(
      { error: 'SUNO_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const taskId = request.nextUrl.searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    console.log('Checking status for taskId:', taskId)

    // sunoapi.orgのステータス確認API
    const response = await fetch(`https://api.sunoapi.org/api/v1/music/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Suno status API error:', errorText)
      return NextResponse.json(
        { error: `Status check failed: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('Suno status response:', JSON.stringify(data, null, 2))

    // sunoapi.orgのレスポンス形式を処理
    // 通常、dataにsongs配列が含まれる
    if (data.code === 200 && data.data) {
      const songs = data.data
      
      // 配列の場合（2曲生成される）
      if (Array.isArray(songs) && songs.length > 0) {
        const firstSong = songs[0]
        
        // 完了チェック - audio_urlまたはsong_urlがあれば完了
        if (firstSong.audio_url || firstSong.song_url || firstSong.stream_url) {
          const trackUrl = firstSong.audio_url || firstSong.song_url || firstSong.stream_url
          return NextResponse.json({
            status: 'completed',
            trackUrl: trackUrl,
            title: firstSong.title,
            duration: firstSong.duration,
          })
        }
        
        // まだ処理中
        return NextResponse.json({
          status: 'processing',
          progress: firstSong.progress || 0,
        })
      }
      
      // オブジェクトの場合
      if (data.data.audio_url || data.data.song_url || data.data.stream_url) {
        const trackUrl = data.data.audio_url || data.data.song_url || data.data.stream_url
        return NextResponse.json({
          status: 'completed',
          trackUrl: trackUrl,
        })
      }
      
      // ステータスフィールドがある場合
      if (data.data.status) {
        return NextResponse.json({
          status: data.data.status === 'complete' ? 'completed' : 'processing',
          trackUrl: data.data.audio_url || data.data.song_url || null,
        })
      }
    }

    // まだ処理中と判断
    return NextResponse.json({
      status: 'processing',
      rawData: data,
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}