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
  switchPoints: Array<{
    time: number
    reason: string
    intensity: number
    suggestedTransition: string
  }>
  overallFeel: string
}

const AUDIO_ANALYSIS_PROMPT = `あなたは音楽プロデューサー兼動画編集の専門家です。
音源の特徴量データを分析し、画像を切り替える最適なタイミングを提案してください。

## 重要な指示

1. **画像切り替えポイント（switchPoints）は必ず指定された枚数分を生成してください**
2. **リズムの変化を重視**: ドラムフィル、ブレイク、ビルドアップなどの瞬間は最高の切り替えポイント
3. **サビの入りは印象的に**: サビに入る瞬間（drop）は intensity を高く
4. **静かな部分では余韻を**: ゆっくりしたフェードやディゾルブを提案
5. **ビートに合わせる**: 可能な限り強拍（strong beat）に合わせた時間を提案

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
  "switchPoints": [
    {
      "time": 秒（小数点2桁まで）,
      "reason": "なぜこのタイミングで切り替えるべきか",
      "intensity": 1-10（切り替えの印象度）,
      "suggestedTransition": "cut/fade/dissolve/slide-left/slide-right/zoom/wipe"
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

## 指示
1. **switchPointsは${imageCount - 1}個生成してください**（最初の画像は0秒から始まるため）
2. ハイライト（drop, buildup, fillin等）の時刻を優先的にswitchPointsに含めてください
3. それ以外は強拍に合わせて均等に分散させてください
4. サビやドロップ直前には「buildup」のrhythmEventを追加し、そこで切り替えると効果的であることを示してください
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
    switchPoints,
  }
}