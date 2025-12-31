// Claude API クライアント

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

interface ClaudeContentBlock {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

interface ClaudeResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
}

export async function callClaude(
  messages: ClaudeMessage[],
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${response.status} - ${error}`)
  }

  const data: ClaudeResponse = await response.json()
  return data.content[0]?.text || ''
}

// 画像分析用のプロンプト
export const IMAGE_ANALYSIS_PROMPT = `あなたは画像分析の専門家です。アップロードされた画像を分析し、以下のJSON形式で結果を返してください。

必ず以下のJSON形式のみで回答してください（説明文は不要）：

{
  "scene": "屋外/室内/自然/都市/スタジオ/抽象 のいずれか",
  "mood": "明るい/暗い/ノスタルジック/エネルギッシュ/穏やか/ドラマチック/ロマンチック/ミステリアス のいずれか",
  "genre": "風景/ポートレート/食べ物/建築/アート/イベント/スポーツ/動物/製品/その他 のいずれか",
  "dominantColors": ["#RRGGBB形式で主要な色を3つ"],
  "visualIntensity": 1から10の数値（視覚的なインパクトの強さ）,
  "suggestedDuration": "short/medium/long のいずれか（この画像を表示する推奨時間）",
  "motionSuggestion": "static/zoom-in/zoom-out/pan-left/pan-right/pan-up/pan-down のいずれか",
  "tags": ["画像を説明するタグを5つ程度"]
}
`

// 編集計画生成用のプロンプト
export const EDITING_PLAN_PROMPT = `あなたは動画編集の専門家です。提供された画像分析結果と音源分析結果を基に、最適な動画編集計画を生成してください。

以下の要素を考慮してください：
1. 音楽のビートに合わせて画像を切り替える
2. 音楽のエネルギーレベルに合った画像を配置する
3. 色の連続性を考慮する
4. ハイライト（サビなど）には最もインパクトのある画像を配置する

必ず以下のJSON形式のみで回答してください：

{
  "clips": [
    {
      "imageIndex": 0,
      "startTime": 0.0,
      "endTime": 2.5,
      "transition": {
        "type": "fade/cut/slide-left/slide-right/zoom/dissolve のいずれか",
        "duration": 0.3
      },
      "motion": {
        "type": "static/zoom-in/zoom-out/pan-left/pan-right のいずれか",
        "intensity": 0.1
      }
    }
  ],
  "overallMood": "動画全体のムード",
  "suggestedTitle": "動画のタイトル案"
}
`

// 音源分析結果の解釈用プロンプト
export const AUDIO_INTERPRETATION_PROMPT = `あなたは音楽分析の専門家です。提供された音響特徴量データを解釈し、動画編集に役立つ情報を抽出してください。

必ず以下のJSON形式のみで回答してください：

{
  "genre": "pop/rock/electronic/classical/jazz/ambient/hip-hop/other のいずれか",
  "mood": "upbeat/melancholic/intense/calm/dramatic/romantic のいずれか",
  "energy": 1から10の数値,
  "sections": [
    {
      "start": 0.0,
      "end": 15.0,
      "type": "intro/verse/chorus/bridge/outro のいずれか",
      "energy": 1から10の数値
    }
  ],
  "highlights": [
    {
      "time": 45.2,
      "type": "drop/climax/transition のいずれか",
      "intensity": 1から10の数値
    }
  ],
  "recommendedTransitions": ["このジャンルに合うトランジションを3つ"]
}
`
