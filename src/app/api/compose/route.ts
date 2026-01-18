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
    const { 
      prompt, 
      duration, 
      genre, 
      mood, 
      tempo, 
      withLyrics,
      // 追加情報
      season,
      occasion,
      expression,
      colorMood,
    } = await request.json()

    // 曲の長さを秒数で指定（動的に計算された値を使用、最低15秒）
    const targetDuration = Math.max(15, duration || 60)
    
    // 詳細なプロンプトを構築
    const promptParts: string[] = []
    
    // 基本情報
    promptParts.push(`${mood || 'uplifting'} ${genre || 'pop'} music`)
    promptParts.push(`${tempo || 'medium'} tempo`)
    
    // 季節感を追加
    if (season && season !== '不明') {
      const seasonMusicMap: { [key: string]: string } = {
        '春': 'fresh spring vibes, cherry blossom feeling',
        '夏': 'summer energy, bright and sunny',
        '秋': 'autumn melancholy, warm colors',
        '冬': 'winter atmosphere, cozy feeling',
      }
      if (seasonMusicMap[season]) {
        promptParts.push(seasonMusicMap[season])
      }
    }
    
    // 行事/シーンを追加
    if (occasion && occasion !== '不明') {
      const occasionMusicMap: { [key: string]: string } = {
        '結婚式': 'wedding celebration, romantic and elegant',
        'ウェディング': 'wedding celebration, romantic and elegant',
        '誕生日': 'birthday celebration, festive and happy',
        '卒業式': 'graduation ceremony, nostalgic and hopeful',
        'パーティー': 'party music, fun and energetic',
        '旅行': 'travel adventure, exciting journey',
        'デート': 'romantic date, sweet and intimate',
        '家族団らん': 'family gathering, warm and loving',
        'スポーツ': 'sports energy, powerful and motivating',
      }
      if (occasionMusicMap[occasion]) {
        promptParts.push(occasionMusicMap[occasion])
      }
    }
    
    // 表情から感情を追加
    if (expression && expression !== 'なし') {
      const expressionMusicMap: { [key: string]: string } = {
        '笑顔': 'happy and joyful',
        '幸福': 'blissful and content',
        '真剣': 'focused and determined',
        '情熱的': 'passionate and intense',
        '穏やか': 'peaceful and serene',
        'リラックス': 'relaxed and chill',
        '緊張': 'tense and anticipating',
      }
      if (expressionMusicMap[expression]) {
        promptParts.push(expressionMusicMap[expression])
      }
    }
    
    // 色調から雰囲気を追加
    if (colorMood) {
      const colorMusicMap: { [key: string]: string } = {
        '暖かい': 'warm tones',
        '冷たい': 'cool atmosphere',
        '鮮やか': 'vibrant and colorful',
        '落ち着いた': 'calm and muted',
        'パステル': 'soft pastel feeling',
        'ビビッド': 'bold and striking',
      }
      if (colorMusicMap[colorMood]) {
        promptParts.push(colorMusicMap[colorMood])
      }
    }
    
    // 歌詞の有無
    if (withLyrics) {
      promptParts.push('catchy vocals, memorable melody')
    } else {
      promptParts.push('instrumental background music, no vocals')
    }

    const musicPrompt = promptParts.join(', ')
    const style = `${genre || 'pop'}, ${mood || 'uplifting'}, ${tempo || 'medium'}`

    // 時間指示をstyleに追加（V5はプロンプトで時間をコントロール可能）
    let durationInstruction = ''
    if (targetDuration <= 60) {
      durationInstruction = `short-form performance, under 1 minute, ${Math.max(30, targetDuration - 15)} to ${targetDuration + 15} seconds`
    } else if (targetDuration <= 120) {
      const minMinutes = Math.floor((targetDuration - 15) / 60)
      const maxMinutes = Math.ceil((targetDuration + 15) / 60)
      durationInstruction = `short-form performance, ${minMinutes} to ${maxMinutes} minutes, around ${Math.round(targetDuration)} seconds`
    } else if (targetDuration <= 180) {
      durationInstruction = `medium-form performance, 2 to 3 minutes`
    } else {
      durationInstruction = `long-form performance, over 3 minutes, 3 to 4 minutes`
    }
    
    // styleに時間指示を含める
    const styleWithDuration = `${style}, ${durationInstruction}`

    console.log('Suno API request:', { 
      prompt: musicPrompt, 
      style: styleWithDuration, 
      withLyrics, 
      targetDuration,
      model: 'V5',
      styleWeight: 0.85,
    })

    // sunoapi.org API呼び出し（V5モデル + styleWeight 0.85）
    const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customMode: true,
        instrumental: !withLyrics,
        model: 'V5',  // V5はプロンプトの反映度が高い
        prompt: musicPrompt,
        style: styleWithDuration,
        title: withLyrics ? 'AI Generated Song' : 'AI Generated BGM',
        styleWeight: 0.85,  // 時間指示をより反映させる
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
        targetDuration,  // フロントエンドに目標の長さを返す
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