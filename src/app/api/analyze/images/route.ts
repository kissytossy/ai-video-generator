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
  // 追加分析項目
  facialExpression?: string  // 表情
  clothing?: string          // 服装
  season?: string            // 季節感
  occasion?: string          // シーン/行事
  emotionalImpact?: string   // 感情的インパクト
  colorMood?: string         // 色彩から受ける印象
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
音楽生成AIに渡すための情報を抽出することが目的です。

{
  "scene": "シーンの説明（屋外/室内/自然/都市/スタジオ/海/山/街中など）",
  "mood": "画像の雰囲気（明るい/エネルギッシュ/穏やか/ドラマチック/ロマンチック/神秘的/情熱的/切ない/爽やか/力強いなど）",
  "genre": "画像のジャンル（風景/ポートレート/建築/アート/イベント/製品/スポーツ/ウェディング/家族/旅行など）",
  "dominantColors": ["#色コード1", "#色コード2", "#色コード3"],
  "visualIntensity": 1-10の数値（視覚的なインパクトの強さ）,
  "suggestedDuration": "short/medium/long（この画像を表示する推奨時間）",
  "motionSuggestion": "zoom-in/zoom-out/pan-left/pan-right/static（推奨カメラモーション）",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "atmosphere": "画像全体の雰囲気を一言で（例：爽やか、切ない、力強い、幻想的、温かい、ノスタルジック）",
  "musicGenre": "この画像に合う音楽ジャンル（pop/rock/electronic/ambient/cinematic/jazz/classical/r&b/hip-hop/folk/acoustic/orchestral）",
  "musicMood": "この画像に合う音楽のムード（uplifting/melancholic/energetic/calm/dramatic/romantic/mysterious/nostalgic/hopeful/intense/joyful/peaceful）",
  "musicTempo": "slow/medium/fast",
  "dynamism": 1-10の数値（躍動感・スピード感の強さ。重要：以下を参考に）
    - 8-10: スポーツ、ダンス、爆発、走る動物、アクション、パーティー、祭り
    - 5-7: 歩く人、会話、軽い運動、街の風景、カフェ
    - 1-4: 静物、風景、ポートレート、睡眠、瞑想、静かな自然,
  "facialExpression": "人物がいる場合の表情（笑顔/真剣/悲しみ/驚き/穏やか/情熱的/幸福/緊張/リラックス/なし）",
  "clothing": "服装の印象（カジュアル/フォーマル/スポーティ/伝統的/ウェディングドレス/スーツ/夏服/冬服/水着/着物/なし）",
  "season": "季節感（春/夏/秋/冬/不明）",
  "occasion": "シーンや行事（日常/旅行/結婚式/お祝い/スポーツ/仕事/自然散策/パーティー/卒業式/誕生日/デート/家族団らん/不明）",
  "emotionalImpact": "この画像が見る人に与える感情的インパクトを一文で（例：幸せな気持ちになる家族の笑顔）",
  "colorMood": "色彩から受ける印象（暖かい/冷たい/鮮やか/落ち着いた/モノクロ的/パステル/ビビッド/アースカラー）"
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
    dynamism: 5,
    facialExpression: 'なし',
    clothing: 'なし',
    season: '不明',
    occasion: '不明',
    emotionalImpact: '一般的な印象',
    colorMood: '落ち着いた',
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const indexStr = formData.get('index') as string | null
    const useAI = formData.get('useAI') as string | null

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
        
        console.log(`Image ${index} analysis:`, {
          dynamism: analysis.dynamism,
          facialExpression: analysis.facialExpression,
          clothing: analysis.clothing,
          season: analysis.season,
          occasion: analysis.occasion,
        })
        
        return NextResponse.json({
          success: true,
          analysis,
          usedAI: true,
        })
      } catch (aiError) {
        console.error('AI analysis failed, falling back to simple:', aiError)
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