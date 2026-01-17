import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface ImageAnalysisResult {
  scene: string
  mood: string
  genre: string
  dominantColors: string[]
  visualIntensity: number
  suggestedDuration: 'short' | 'medium' | 'long'
  motionSuggestion: string
  tags: string[]
  // AI自動生成モード用の追加フィールド
  atmosphere?: string
  musicGenre?: string
  musicMood?: string
  musicTempo?: 'slow' | 'medium' | 'fast'
  // 躍動感スコア（1-10）- 表示時間の計算に使用
  dynamism?: number
}

// Claude Vision APIで画像を分析
async function analyzeImageWithClaude(imageBase64: string, mimeType: string): Promise<ImageAnalysisResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `この画像を分析して、以下のJSON形式で回答してください。

{
  "scene": "シーンの説明（屋外/室内/自然/都市/スタジオ/抽象など）",
  "mood": "画像の雰囲気（明るい/エネルギッシュ/穏やか/ドラマチック/ロマンチック/神秘的/情熱的など）",
  "genre": "画像のジャンル（風景/ポートレート/建築/アート/イベント/製品など）",
  "dominantColors": ["#色コード1", "#色コード2", "#色コード3"],
  "visualIntensity": 1-10の数値（視覚的なインパクトの強さ）,
  "suggestedDuration": "short/medium/long（この画像を表示する推奨時間）",
  "motionSuggestion": "zoom-in/zoom-out/pan-left/pan-right/static（推奨カメラモーション）",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "atmosphere": "画像全体の雰囲気を一言で",
  "musicGenre": "この画像に合う音楽ジャンル（pop/rock/electronic/ambient/cinematic/jazz/classical）",
  "musicMood": "この画像に合う音楽のムード（uplifting/melancholic/energetic/calm/dramatic/romantic/mysterious）",
  "musicTempo": "slow/medium/fast",
  "dynamism": 1-10の数値（躍動感・スピード感の強さ。スポーツ、ダンス、爆発、走る動物などは8-10。静物、風景、ポートレートなどは1-4。中程度のアクションは5-7）
}

JSONのみを回答してください。`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Claude API error:', errorText)
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text || ''
  
  // JSONをパース
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  
  throw new Error('Failed to parse Claude response')
}

// 画像の簡易分析（フォールバック用）
function analyzeImageSimple(index: number): ImageAnalysisResult {
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
    atmosphere: '一般的',
    musicGenre: 'pop',
    musicMood: 'uplifting',
    musicTempo: 'medium',
    dynamism: 5,  // デフォルトは中程度
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const indexStr = formData.get('index') as string | null
    const useAI = formData.get('useAI') as string | null  // AI分析を使うか

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    const index = indexStr ? parseInt(indexStr, 10) : 0

    // AI分析モードの場合はClaude Vision APIを使用
    if (useAI === 'true' && ANTHROPIC_API_KEY) {
      try {
        const arrayBuffer = await image.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = image.type || 'image/jpeg'
        
        const analysis = await analyzeImageWithClaude(base64, mimeType)
        
        return NextResponse.json({
          success: true,
          analysis,
          usedAI: true,
        })
      } catch (aiError) {
        console.error('AI analysis failed, falling back to simple:', aiError)
        // フォールバック
        const analysis = analyzeImageSimple(index)
        return NextResponse.json({
          success: true,
          analysis,
          usedAI: false,
        })
      }
    }

    // 簡易分析
    const analysis = analyzeImageSimple(index)
    
    return NextResponse.json({
      success: true,
      analysis,
      usedAI: false,
    })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image', details: String(error) },
      { status: 500 }
    )
  }
}