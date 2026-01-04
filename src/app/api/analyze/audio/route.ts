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

## 絶対ルール（必守）

1. **全ての画像を必ず使う**: 指定された画像枚数分のswitchPointsを必ず生成する
2. **switchPointsの数 = 画像枚数 - 1**: 最初の画像は0秒から始まるため

## 高速切り替えの条件（重要！）

以下の**いずれか**に該当する区間は高速切り替え（0.2〜0.5秒刻み）：

1. **ビルドアップ・フィルイン**: サビ前のドラムフィル、スネア連打、ベースライン上昇
2. **インスト区間の小刻みなビート**: ボーカルがない区間でドラム・ベース・ギターが刻むリズム
3. **ブレイクダウン後の復帰**: 静寂から一気に盛り上がる瞬間
4. **高エネルギー区間**: エネルギーが7以上で強拍が密集している区間

## 画像配分の考え方

- **高速切り替え区間**: 0.2〜0.5秒間隔（複数枚を短時間に密集）
- **サビ・クライマックス**: 1.5〜3秒
- **静かな区間**: 2〜4秒

例：19枚、30秒の場合
- イントロ (0-6秒): 2枚（各3秒）
- Aメロ (6-12秒): 3枚（各2秒）
- インスト・ビート区間 (12-15秒): 5枚（各0.6秒）← 高速！
- ビルドアップ (15-17秒): 4枚（各0.5秒）← 高速！
- サビ (17-27秒): 4枚（各2.5秒）
- アウトロ (27-30秒): 1枚（3秒）
合計: 2+3+5+4+4+1 = 19枚

必ず以下のJSON形式のみで回答してください：

{
  "genre": "pop/rock/electronic/hip-hop/jazz/classical/ambient/other",
  "mood": "upbeat/melancholic/intense/calm/dramatic/romantic/mysterious/energetic",
  "overallFeel": "曲全体の印象を1-2文で説明",
  "sections": [
    {
      "start": 開始秒,
      "end": 終了秒,
      "type": "intro/verse/pre-chorus/chorus/bridge/outro/breakdown/buildup/instrumental",
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
      "reason": "ビルドアップ/インストのビート刻み/フィルイン など",
      "suggestedInterval": 0.3
    }
  ],
  "switchPoints": [
    {
      "time": 秒（小数点2桁まで）,
      "reason": "なぜこのタイミングで切り替えるべきか",
      "intensity": 1-10（高速切り替え区間は8-10）,
      "suggestedTransition": "cut/fade/dissolve/slide-left/slide-right/zoom/wipe",
      "isRapid": true/false
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

### 絶対ルール
- **switchPointsは必ず${imageCount - 1}個生成**（全${imageCount}枚の画像を使用）
- 足りない場合は強拍に合わせて追加すること

### 高速切り替え区間の検出
以下のいずれかに該当する区間を見つけてrapidSectionsに追加：
1. ビルドアップ・フィルイン（サビ前のドラム連打など）
2. **インスト区間で小刻みなビートが入る部分**（ボーカルなしでもOK）
3. エネルギー7以上で強拍が密集している区間

### 画像配分
- 高速区間：0.2〜0.5秒間隔で複数枚を密集
- サビ：1.5〜3秒
- 静かな区間：2〜4秒

### 計算例（${imageCount}枚、${audioFeatures.duration.toFixed(0)}秒）
rapidSectionが2箇所（計4秒）あると仮定：
- 高速区間に8枚（4秒÷0.5秒）
- 残り${imageCount - 8}枚を残り${(audioFeatures.duration - 4).toFixed(0)}秒に配分
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
  
  // まず既存のポイントを時間順にソート
  existing.sort((a, b) => a.time - b.time)
  
  while (existing.length < needed) {
    // 最も間隔が広い箇所を見つける
    let maxGap = 0
    let gapStart = 0
    let gapEnd = duration
    let insertIndex = existing.length
    
    // 0秒から最初のポイントまでの間隔
    if (existing.length > 0 && existing[0].time > maxGap) {
      maxGap = existing[0].time
      gapStart = 0
      gapEnd = existing[0].time
      insertIndex = 0
    }
    
    // 各ポイント間の間隔
    for (let i = 0; i < existing.length - 1; i++) {
      const gap = existing[i + 1].time - existing[i].time
      if (gap > maxGap) {
        maxGap = gap
        gapStart = existing[i].time
        gapEnd = existing[i + 1].time
        insertIndex = i + 1
      }
    }
    
    // 最後のポイントからdurationまでの間隔
    if (existing.length > 0) {
      const lastGap = duration - existing[existing.length - 1].time
      if (lastGap > maxGap) {
        maxGap = lastGap
        gapStart = existing[existing.length - 1].time
        gapEnd = duration
        insertIndex = existing.length
      }
    }
    
    // 間隔の中央付近の強拍を探す
    const targetTime = (gapStart + gapEnd) / 2
    let bestTime = targetTime
    
    // 強拍があればそれを使う
    const beatsInGap = strongBeats.filter(t => t > gapStart + 0.1 && t < gapEnd - 0.1)
    if (beatsInGap.length > 0) {
      bestTime = beatsInGap.reduce((nearest, beat) =>
        Math.abs(beat - targetTime) < Math.abs(nearest - targetTime) ? beat : nearest
      , beatsInGap[0])
      // 使用した強拍を除外
      const idx = strongBeats.indexOf(bestTime)
      if (idx > -1) strongBeats.splice(idx, 1)
    }
    
    existing.push({
      time: Math.round(bestTime * 100) / 100,
      reason: 'ビートに合わせた切り替え',
      intensity: 5,
      suggestedTransition: 'cut',
      isRapid: false,
    })
    
    // 時間順にソート
    existing.sort((a, b) => a.time - b.time)
  }
  
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