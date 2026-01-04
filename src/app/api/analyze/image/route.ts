import { NextRequest, NextResponse } from 'next/server'
import { callClaudeWithImage, IMAGE_ANALYSIS_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 30

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

// フォールバック用の簡易分析
function analyzeImageFallback(index: number): ImageAnalysisResult {
  const scenes = ['屋外', '室内', '自然', '都市', 'スタジオ', '抽象']
  const moods = ['明るい', 'エネルギッシュ', '穏やか', 'ドラマチック', 'ロマンチック']
  const genres = ['風景', 'ポートレート', '建築', 'アート', 'イベント', '製品']
  const motions = ['static', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']
  const durations: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
  
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

    let analysis: ImageAnalysisResult

    try {
      // 画像をBase64に変換
      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = image.type || 'image/jpeg'

      // Claude Vision APIで画像を分析
      const response = await callClaudeWithImage(
        base64,
        mediaType,
        `この画像を分析して、以下のJSON形式で結果を返してください。JSONのみを出力してください。

{
  "scene": "屋外/室内/自然/都市/スタジオ/抽象 のいずれか",
  "mood": "明るい/暗い/ノスタルジック/エネルギッシュ/穏やか/ドラマチック/ロマンチック/ミステリアス のいずれか",
  "genre": "風景/ポートレート/食べ物/建築/アート/イベント/スポーツ/動物/製品/その他 のいずれか",
  "dominantColors": ["#RRGGBB形式で主要な色を3つ"],
  "visualIntensity": 1から10の数値（視覚的なインパクトの強さ）,
  "suggestedDuration": "short/medium/long のいずれか",
  "motionSuggestion": "static/zoom-in/zoom-out/pan-left/pan-right のいずれか（この画像に最適なモーション）",
  "tags": ["画像を説明するタグを5つ"]
}`
      )

      // JSONをパース
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (aiError) {
      console.error('Claude Vision API error, using fallback:', aiError)
      // APIエラー時はフォールバック
      analysis = analyzeImageFallback(index)
    }
    
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