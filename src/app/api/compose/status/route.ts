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
    const retry = request.nextUrl.searchParams.get('retry') || '0'

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    console.log(`Checking status for taskId: ${taskId} (retry: ${retry})`)

    // キャッシュ対策を強化
    const timestamp = Date.now()
    const randomParam = Math.random().toString(36).substring(7)
    
    const response = await fetch(
      `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}&_t=${timestamp}&_r=${randomParam}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUNO_API_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )

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

    if (data.code === 200 && data.data) {
      const taskData = data.data
      
      // ステータスがSUCCESSなら完了
      if (taskData.status === 'SUCCESS' && taskData.response?.sunoData) {
        const songs = taskData.response.sunoData
        if (Array.isArray(songs) && songs.length > 0) {
          const firstSong = songs[0]
          const trackUrl = firstSong.audioUrl || firstSong.audio_url || firstSong.streamAudioUrl || firstSong.sourceAudioUrl
          
          if (trackUrl) {
            console.log('✅ Music generation completed! URL:', trackUrl)
            return NextResponse.json({
              status: 'completed',
              trackUrl: trackUrl,
              title: firstSong.title,
              duration: firstSong.duration,
            })
          }
        }
      }
      
      // まだ処理中
      if (taskData.status === 'PENDING' || 
          taskData.status === 'TEXT_SUCCESS' || 
          taskData.status === 'FIRST_SUCCESS' || 
          taskData.status === 'PROCESSING' || 
          !taskData.status) {
        
        // 10回以上PENDINGが続いたら、一度SUCCESSを再確認
        const retryCount = parseInt(retry)
        if (retryCount >= 10 && taskData.status === 'PENDING') {
          console.log('⚠️ PENDING続行中、強制再確認フラグ')
          return NextResponse.json({
            status: 'processing',
            taskStatus: taskData.status || 'unknown',
            forceRecheck: true,
          })
        }
        
        return NextResponse.json({
          status: 'processing',
          taskStatus: taskData.status || 'unknown',
        })
      }
      
      // エラーの場合
      if (taskData.status === 'CREATE_TASK_FAILED' || 
          taskData.status === 'GENERATE_AUDIO_FAILED' ||
          taskData.status === 'CALLBACK_EXCEPTION' ||
          taskData.status === 'SENSITIVE_WORD_ERROR' ||
          taskData.errorMessage) {
        return NextResponse.json({
          status: 'failed',
          error: taskData.errorMessage || taskData.status || 'Generation failed',
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