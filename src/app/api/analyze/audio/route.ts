import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 60

interface AudioFeatures {
  bpm: number
  energy: number
  waveformData: number[]
  beats: Array<{ time: number; strength: string }>
  sections: Array<{ start: number; end: number; type: string; energy: number }>
  highlights: Array<{ time: number; type: string; intensity: number }>
  duration: number
}

interface RhythmEvent {
  time: number
  type: 'beat' | 'accent' | 'fill' | 'break' | 'drop' | 'buildup'
  intensity: number
  description?: string
}

interface RapidSection {
  start: number
  end: number
  reason: string
  suggestedInterval: number
}

interface EnhancedAudioAnalysis {
  genre: string
  mood: string
  energy: number
  bpm: number
  sections: Array<{
    start: number
    end: number
    type: string
    energy: number
    description: string
  }>
  rhythmEvents: RhythmEvent[]
  rapidSections: RapidSection[]
  switchPoints: Array<{
    time: number
    reason: string
    intensity: number
    suggestedTransition: string
    isRapid?: boolean
  }>
  overallFeel: string
}

const AUDIO_ANALYSIS_PROMPT = `あなたは音楽プロデューサー兼動画編集の専門家です。
音源の特徴量データを分析し、画像を切り替える最適なタイミングを提案してください。

## 最重要：画像切り替えの「密度」を曲調に合わせる

**これが最も重要なコンセプトです：**
- **ビルドアップ・フィルイン区間**（サビ前のドラムフィル、ベースのスラップ、ギターの速弾きなど）
  → **0.2〜0.5秒刻み**で画像を高速切り替え！複数枚をこの区間に「密集」させる
- **サビ・クライマックス区間**
  → **2〜4秒**でじっくり見せる
- **静かな区間・イントロ・アウトロ**
  → **3〜5秒**でゆったり

例：19枚の画像、30秒の曲の場合
- イントロ (0-8秒): 画像1-3を使用（各2-3秒）
- Aメロ (8-16秒): 画像4-7を使用（各2秒）
- ビルドアップ (16-18秒): 画像8-13を使用（各0.3秒！）← ここで6枚を2秒に詰め込む
- サビ (18-28秒): 画像14-17を使用（各2.5秒）
- アウトロ (28-30秒): 画像18-19を使用（各1秒）

## 切り替えタイミングの決め方

1. **ビルドアップ/フィルイン区間を最優先で特定**
   - ドラムロール、スネアの連打、ベースラインの上昇
   - この区間には画像を「密集」配置（0.2-0.5秒間隔）
   
2. **残りの画像を他の区間に配分**
   - サビは印象的な画像を長めに（2-4秒）
   - 静かな部分はゆったり（3-5秒）

3. **必ず強拍（ビート）に合わせる**
   - 切り替えタイミングは提供された強拍時刻から選ぶ

必ず以下のJSON形式のみで回答してください：

{
  "genre": "pop/rock/electronic/hip-hop/jazz/classical/ambient/other",
  "mood": "upbeat/melancholic/intense/calm/dramatic/romantic/mysterious/energetic",
  "overallFeel": "曲全体の印象を1-2文で説明",
  "sections": [
    {
      "start": 開始秒,
      "end": 終了秒,
      "type": "intro/verse/pre-chorus/chorus/bridge/outro/breakdown/buildup",
      "energy": 1-10,
      "description": "このセクションの音楽的特徴"
    }
  ],
  "rhythmEvents": [
    {
      "time": 秒,
      "type": "beat/accent/fill/break/drop/buildup",
      "intensity": 1-10,
      "description": "例：ドラムフィルでサビに突入"
    }
  ],
  "rapidSections": [
    {
      "start": 開始秒,
      "end": 終了秒,
      "reason": "なぜ高速切り替えが効果的か（例：ドラムフィルに合わせて）",
      "suggestedInterval": 0.3
    }
  ],
  "switchPoints": [
    {
      "time": 秒（小数点2桁まで）,
      "reason": "なぜこのタイミングで切り替えるべきか",
      "intensity": 1-10（切り替えの印象度。高速切り替え区間は8-10）,
      "suggestedTransition": "cut/fade/dissolve/slide-left/slide-right/zoom/wipe",
      "isRapid": true/false（高速切り替え区間内かどうか）
    }
  ]
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const audioFeatures: AudioFeatures = body.audioFeatures
    const imageCount: number = body.imageCount || 10

    if (!audioFeatures) {
      return NextResponse.json(
        { error: 'No audio features provided' },
        { status: 400 }
      )
    }

    // 音響特徴量をテキスト化してClaudeに送信
    const strongBeats = audioFeatures.beats
      .filter(b => b.strength === 'strong')
      .map(b => b.time)

    const featureDescription = `
## 音源の基本情報
- BPM: ${audioFeatures.bpm}
- エネルギーレベル: ${audioFeatures.energy}/10
- 長さ: ${audioFeatures.duration.toFixed(1)}秒
- **使用する画像枚数: ${imageCount}枚**（この枚数分のswitchPointsを生成してください）

## 強拍（Strong Beat）の時刻
以下の時刻が強拍です。画像切り替えはこれらの時刻に合わせると効果的です：
${strongBeats.slice(0, 60).map(t => t.toFixed(2)).join(', ')}${strongBeats.length > 60 ? '...' : ''}

## 検出されたセクション（参考情報）
${audioFeatures.sections.map(s => 
  `- ${s.start.toFixed(1)}秒〜${s.end.toFixed(1)}秒: ${s.type} (エネルギー: ${s.energy}/10)`
).join('\n')}

## 検出されたハイライト（重要！これらは特に印象的な切り替えポイント候補）
${audioFeatures.highlights.map(h => 
  `- ${h.time.toFixed(2)}秒: ${h.type} (強度: ${h.intensity}/10)`
).join('\n')}

## エネルギー分布（曲の流れを把握するため）
${(() => {
  const segments = 10
  const waveform = audioFeatures.waveformData
  const segmentSize = Math.floor(waveform.length / segments)
  const duration = audioFeatures.duration
  return Array.from({ length: segments }, (_, i) => {
    const start = i * segmentSize
    const end = Math.min((i + 1) * segmentSize, waveform.length)
    const avg = waveform.slice(start, end).reduce((a, b) => a + b, 0) / (end - start)
    const percent = Math.round(avg * 100)
    const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10))
    const timeStart = (duration * i / segments).toFixed(1)
    const timeEnd = (duration * (i + 1) / segments).toFixed(1)
    return `${timeStart}s〜${timeEnd}s: ${bar} ${percent}%`
  }).join('\n')
})()}

## 重要な指示

### 画像配分の考え方
${imageCount}枚の画像を以下のように配分してください：

1. **ビルドアップ/フィルイン区間を特定**（エネルギーが急上昇する直前、ドラムフィルなど）
   - この区間には画像を「密集」させる（0.2〜0.5秒間隔）
   - 例：2秒間のビルドアップに5〜6枚を詰め込む

2. **残りの画像を他区間に配分**
   - サビ・クライマックス：2〜4秒
   - 静かな区間：3〜5秒

3. **switchPointsは${imageCount - 1}個生成**
   - 高速切り替え区間では連続した短い間隔のポイントを生成
   - isRapid: true を必ず設定

### 具体例（${imageCount}枚、${audioFeatures.duration.toFixed(0)}秒の場合）
もしビルドアップが15-17秒にあるなら：
- 0-15秒：6枚を使用（各2-3秒）
- 15-17秒：6枚を高速切り替え（各0.3秒）← rapidSection
- 17-${audioFeatures.duration.toFixed(0)}秒：残り${imageCount - 12}枚（各2-3秒）

**rapidSectionsは必ず1つ以上指定してください。**
`

    let enhancedAnalysis: EnhancedAudioAnalysis

    try {
      const response = await callClaude(
        [{ role: 'user', content: featureDescription }],
        AUDIO_ANALYSIS_PROMPT
      )

      // JSONをパース
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        enhancedAnalysis = JSON.parse(jsonMatch[0])
        
        // switchPointsの数を検証
        if (!enhancedAnalysis.switchPoints || enhancedAnalysis.switchPoints.length < imageCount - 1) {
          console.log(`Not enough switchPoints: got ${enhancedAnalysis.switchPoints?.length || 0}, need ${imageCount - 1}. Supplementing...`)
          enhancedAnalysis = supplementSwitchPoints(enhancedAnalysis, audioFeatures, imageCount)
        }
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (aiError) {
      console.error('Claude API error:', aiError)
      // フォールバック
      enhancedAnalysis = generateFallbackAnalysis(audioFeatures, imageCount)
    }

    // 元の分析結果とマージ
    const finalAnalysis = {
      ...enhancedAnalysis,
      bpm: audioFeatures.bpm,
      energy: enhancedAnalysis.energy || audioFeatures.energy,
      beats: audioFeatures.beats,
      originalHighlights: audioFeatures.highlights,
    }

    return NextResponse.json({
      success: true,
      analysis: finalAnalysis,
    })
  } catch (error) {
    console.error('Audio analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze audio', details: String(error) },
      { status: 500 }
    )
  }
}

// switchPointsが足りない場合に補完
function supplementSwitchPoints(
  analysis: EnhancedAudioAnalysis,
  features: AudioFeatures,
  imageCount: number
): EnhancedAudioAnalysis {
  const needed = imageCount - 1
  const existing = analysis.switchPoints || []
  const existingTimes = new Set(existing.map(sp => Math.round(sp.time * 10) / 10))
  
  const strongBeats = features.beats
    .filter(b => b.strength === 'strong')
    .map(b => b.time)
    .filter(t => !existingTimes.has(Math.round(t * 10) / 10))
  
  const duration = features.duration
  const interval = duration / imageCount
  
  while (existing.length < needed && strongBeats.length > 0) {
    // 次に追加すべき理想の時刻
    const targetTime = (existing.length + 1) * interval
    
    // 最寄りの強拍を見つける
    let nearestBeat = strongBeats[0]
    let minDiff = Math.abs(strongBeats[0] - targetTime)
    for (const beat of strongBeats) {
      const diff = Math.abs(beat - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        nearestBeat = beat
      }
    }
    
    existing.push({
      time: nearestBeat,
      reason: 'ビートに合わせた切り替え',
      intensity: 5,
      suggestedTransition: 'cut',
    })
    
    // 使用した強拍を除外
    const idx = strongBeats.indexOf(nearestBeat)
    if (idx > -1) strongBeats.splice(idx, 1)
  }
  
  // 時間順にソート
  existing.sort((a, b) => a.time - b.time)
  
  return {
    ...analysis,
    switchPoints: existing,
  }
}

// フォールバック分析
function generateFallbackAnalysis(
  features: AudioFeatures,
  imageCount: number
): EnhancedAudioAnalysis {
  const duration = features.duration
  const switchInterval = duration / imageCount

  const switchPoints = []
  const strongBeats = features.beats.filter(b => b.strength === 'strong')
  
  for (let i = 1; i < imageCount; i++) {
    const targetTime = i * switchInterval
    
    // 最寄りの強拍に合わせる
    let nearestBeat = { time: targetTime }
    let minDiff = Infinity
    for (const beat of strongBeats) {
      const diff = Math.abs(beat.time - targetTime)
      if (diff < minDiff && diff < switchInterval / 2) {
        minDiff = diff
        nearestBeat = beat
      }
    }

    switchPoints.push({
      time: Math.round(nearestBeat.time * 100) / 100,
      reason: 'ビートに合わせた切り替え',
      intensity: 5,
      suggestedTransition: 'cut',
    })
  }

  // ハイライトをrhythmEventsに変換
  const rhythmEvents: RhythmEvent[] = features.highlights.map(h => ({
    time: h.time,
    type: h.type as RhythmEvent['type'],
    intensity: h.intensity,
  }))

  // ビルドアップ/フィルインをrapidSectionsとして検出
  const rapidSections: RapidSection[] = features.highlights
    .filter(h => h.type === 'buildup' || h.type === 'fillin')
    .map(h => ({
      start: Math.max(0, h.time - 1),
      end: h.time + 1,
      reason: `${h.type}区間`,
      suggestedInterval: 0.3,
    }))

  return {
    genre: 'pop',
    mood: features.energy > 6 ? 'upbeat' : 'calm',
    energy: features.energy,
    bpm: features.bpm,
    overallFeel: '自動生成された分析結果',
    sections: features.sections.map(s => ({
      ...s,
      description: `${s.type}セクション`,
    })),
    rhythmEvents,
    rapidSections,
    switchPoints,
  }
}