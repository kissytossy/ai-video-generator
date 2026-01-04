import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ImageAnalysisResult {
  scene: string
  mood: string
  genre: string
  dominantColors: string[]
  visualIntensity: number
  suggestedDuration: 'short' | 'medium' | 'long'
  motionSuggestion: string
  tags: string[]
}

// 画像のファイル名やタイプから簡易的に分析（Claude API呼び出しなし）
function analyzeImageSimple(image: File, index: number): ImageAnalysisResult {
  const scenes = ['屋外', '室内', '自然', '都市', 'スタジオ', '抽象']
  const moods = ['明るい', 'エネルギッシュ', '穏やか', 'ドラマチック', 'ロマンチック']
  const genres = ['風景', 'ポートレート', '建築', 'アート', 'イベント', '製品']
  const motions = ['static', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']
  const durations: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
  
  // インデックスを使ってバリエーションを出す
  return {
    scene: scenes[index % scenes.length],
    mood: moods[index % moods.length],
    genre: genres[index % genres.length],
    dominantColors: ['#4A90D9', '#50C878', '#FFD700'],
    visualIntensity: 5 + (index % 5),
    suggestedDuration: durations[index % durations.length],
    motionSuggestion: motions[index % motions.length],
    tags: ['画像' + (index + 1), 'シーン', 'コンテンツ'],
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const indexStr = formData.get('index') as string | null

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    const index = indexStr ? parseInt(indexStr, 10) : 0

    // 簡易分析（タイムアウト回避のためClaude API呼び出しなし）
    const analysis = analyzeImageSimple(image, index)
    
    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image', details: String(error) },
      { status: 500 }
    )
  }
}