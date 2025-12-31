import { NextRequest, NextResponse } from 'next/server'
import { callClaude, AUDIO_INTERPRETATION_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 30

// フロントエンドから送られてくる音響特徴量
interface AudioFeatures {
  duration: number
  sampleRate: number
  // Meydaから取得する特徴量
  rms: number[]           // 音量レベル
  spectralCentroid: number[] // 周波数の重心
  spectralFlatness: number[] // スペクトルの平坦度
  zcr: number[]           // ゼロ交差率
  energy: number[]        // エネルギー
  // ビート検出結果
  beats: number[]         // ビートの時間位置
  estimatedBpm: number    // 推定BPM
}

interface AudioAnalysisResult {
  genre: string
  mood: string
  energy: number
  sections: Array<{
    start: number
    end: number
    type: string
    energy: number
  }>
  highlights: Array<{
    time: number
    type: string
    intensity: number
  }>
  recommendedTransitions: string[]
  bpm: number
  beats: Array<{
    time: number
    strength: 'strong' | 'weak'
  }>
}

export async function POST(request: NextRequest) {
  try {
    const features: AudioFeatures = await request.json()

    if (!features || !features.duration) {
      return NextResponse.json(
        { error: 'No audio features provided' },
        { status: 400 }
      )
    }

    // 特徴量の統計を計算
    const avgRms = average(features.rms)
    const avgSpectralCentroid = average(features.spectralCentroid)
    const avgSpectralFlatness = average(features.spectralFlatness)
    const energyVariance = variance(features.energy)

    // Claude APIに解釈を依頼
    const prompt = `
## 音響分析データ

### 基本情報
- 長さ: ${features.duration.toFixed(1)}秒
- 推定BPM: ${features.estimatedBpm}
- 検出されたビート数: ${features.beats.length}

### 音響特徴量の統計
- 平均音量(RMS): ${avgRms.toFixed(4)} ${describeLevel(avgRms, 0.1, 0.3)}
- 平均スペクトル重心: ${avgSpectralCentroid.toFixed(0)}Hz ${describeFrequency(avgSpectralCentroid)}
- スペクトル平坦度: ${avgSpectralFlatness.toFixed(4)} ${avgSpectralFlatness > 0.1 ? '(ノイズ/パーカッシブ寄り)' : '(トーナル/メロディック寄り)'}
- エネルギー変動: ${energyVariance.toFixed(4)} ${energyVariance > 0.01 ? '(ダイナミック)' : '(安定)'}

### エネルギー推移（時系列）
${describeEnergyTimeline(features.energy, features.duration)}

### ビート位置
${features.beats.slice(0, 10).map(b => b.toFixed(2) + 's').join(', ')}${features.beats.length > 10 ? '...' : ''}

この音響データを分析し、動画編集に適した形式で結果を返してください。
`

    const response = await callClaude(
      [{ role: 'user', content: prompt }],
      AUDIO_INTERPRETATION_PROMPT
    )

    // JSONをパース
    let analysis: AudioAnalysisResult
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse audio analysis:', parseError)
      // フォールバック
      analysis = generateFallbackAnalysis(features)
    }

    // ビート情報を追加
    analysis.bpm = features.estimatedBpm || analysis.bpm || 120
    analysis.beats = features.beats.map((time, i) => ({
      time,
      strength: i % 4 === 0 ? 'strong' as const : 'weak' as const
    }))

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error('Audio analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze audio', details: String(error) },
      { status: 500 }
    )
  }
}

// ヘルパー関数
function average(arr: number[]): number {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function variance(arr: number[]): number {
  if (!arr || arr.length === 0) return 0
  const avg = average(arr)
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length
}

function describeLevel(value: number, low: number, high: number): string {
  if (value < low) return '(静か)'
  if (value > high) return '(大きい)'
  return '(中程度)'
}

function describeFrequency(centroid: number): string {
  if (centroid < 1000) return '(低音寄り/バス)'
  if (centroid < 3000) return '(中音域)'
  return '(高音寄り/ブライト)'
}

function describeEnergyTimeline(energy: number[], duration: number): string {
  if (!energy || energy.length === 0) return 'データなし'
  
  const segmentCount = Math.min(5, energy.length)
  const segmentSize = Math.floor(energy.length / segmentCount)
  const segments: string[] = []
  
  for (let i = 0; i < segmentCount; i++) {
    const start = i * segmentSize
    const end = Math.min((i + 1) * segmentSize, energy.length)
    const segmentEnergy = average(energy.slice(start, end))
    const timeStart = (i / segmentCount * duration).toFixed(0)
    const timeEnd = ((i + 1) / segmentCount * duration).toFixed(0)
    const level = segmentEnergy > 0.3 ? '高' : segmentEnergy > 0.1 ? '中' : '低'
    segments.push(`${timeStart}s-${timeEnd}s: ${level}`)
  }
  
  return segments.join(' → ')
}

function generateFallbackAnalysis(features: AudioFeatures): AudioAnalysisResult {
  const avgEnergy = average(features.energy)
  
  return {
    genre: 'pop',
    mood: avgEnergy > 0.2 ? 'upbeat' : 'calm',
    energy: Math.round(avgEnergy * 10),
    sections: [
      { start: 0, end: features.duration * 0.2, type: 'intro', energy: 3 },
      { start: features.duration * 0.2, end: features.duration * 0.8, type: 'verse', energy: 6 },
      { start: features.duration * 0.8, end: features.duration, type: 'outro', energy: 4 },
    ],
    highlights: [
      { time: features.duration * 0.5, type: 'climax', intensity: 8 }
    ],
    recommendedTransitions: ['fade', 'cut', 'slide-left'],
    bpm: features.estimatedBpm || 120,
    beats: [],
  }
}
