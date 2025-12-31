import { NextRequest, NextResponse } from 'next/server'
import { callClaude, EDITING_PLAN_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ImageAnalysis {
  scene: string
  mood: string
  genre: string
  dominantColors: string[]
  visualIntensity: number
  suggestedDuration: string
  motionSuggestion: string
  tags: string[]
}

interface AudioAnalysis {
  bpm: number
  genre: string
  mood: string
  energy: number
  beats: Array<{ time: number; strength: string }>
  sections: Array<{ start: number; end: number; type: string; energy: number }>
  highlights: Array<{ time: number; type: string; intensity: number }>
}

interface EditingPlanRequest {
  imageAnalyses: ImageAnalysis[]
  audioAnalysis: AudioAnalysis
  duration: number
  aspectRatio: string
}

interface Clip {
  imageIndex: number
  startTime: number
  endTime: number
  transition: {
    type: string
    duration: number
  }
  motion: {
    type: string
    intensity: number
  }
}

interface EditingPlan {
  clips: Clip[]
  overallMood: string
  suggestedTitle: string
}

export async function POST(request: NextRequest) {
  try {
    const body: EditingPlanRequest = await request.json()
    const { imageAnalyses, audioAnalysis, duration, aspectRatio } = body

    if (!imageAnalyses || imageAnalyses.length === 0) {
      return NextResponse.json(
        { error: 'No image analyses provided' },
        { status: 400 }
      )
    }

    // Claude APIで編集計画を生成
    const prompt = `
## 入力データ

### 画像分析結果（${imageAnalyses.length}枚）
${imageAnalyses.map((img, i) => `
画像${i + 1}:
- シーン: ${img.scene}
- ムード: ${img.mood}
- ジャンル: ${img.genre}
- 視覚的強度: ${img.visualIntensity}/10
- 推奨モーション: ${img.motionSuggestion}
- タグ: ${img.tags.join(', ')}
`).join('\n')}

### 音源分析結果
- BPM: ${audioAnalysis.bpm}
- ジャンル: ${audioAnalysis.genre}
- ムード: ${audioAnalysis.mood}
- エネルギー: ${audioAnalysis.energy}/10
- セクション: ${audioAnalysis.sections.map(s => `${s.type}(${s.start}s-${s.end}s, エネルギー:${s.energy})`).join(', ')}
- ハイライト: ${audioAnalysis.highlights.map(h => `${h.type}@${h.time}s`).join(', ')}

### 出力設定
- 動画の長さ: ${duration}秒
- アスペクト比: ${aspectRatio}

上記の情報を基に、最適な編集計画を生成してください。
各画像は必ず1回以上使用し、音楽のビートとエネルギーに合わせて配置してください。
`

    const response = await callClaude(
      [{ role: 'user', content: prompt }],
      EDITING_PLAN_PROMPT
    )

    // JSONをパース
    let editingPlan: EditingPlan
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        editingPlan = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse editing plan:', parseError)
      
      // フォールバック: シンプルな編集計画を生成
      editingPlan = generateFallbackPlan(imageAnalyses.length, duration, audioAnalysis)
    }

    // クリップの時間を正規化（durationを超えないように）
    editingPlan.clips = normalizeClips(editingPlan.clips, duration, imageAnalyses.length)

    return NextResponse.json({
      success: true,
      editingPlan,
    })
  } catch (error) {
    console.error('Editing plan generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate editing plan', details: String(error) },
      { status: 500 }
    )
  }
}

// フォールバック用のシンプルな編集計画
function generateFallbackPlan(
  imageCount: number, 
  duration: number,
  audioAnalysis: AudioAnalysis
): EditingPlan {
  const clipDuration = duration / imageCount
  const clips: Clip[] = []

  for (let i = 0; i < imageCount; i++) {
    clips.push({
      imageIndex: i,
      startTime: i * clipDuration,
      endTime: (i + 1) * clipDuration,
      transition: {
        type: i === 0 ? 'fade' : 'cut',
        duration: 0.3,
      },
      motion: {
        type: i % 2 === 0 ? 'zoom-in' : 'zoom-out',
        intensity: 0.1,
      },
    })
  }

  return {
    clips,
    overallMood: audioAnalysis.mood || 'energetic',
    suggestedTitle: 'My Video',
  }
}

// クリップの時間を正規化
function normalizeClips(clips: Clip[], duration: number, imageCount: number): Clip[] {
  if (!clips || clips.length === 0) {
    // 空の場合はデフォルトを生成
    const clipDuration = duration / imageCount
    return Array.from({ length: imageCount }, (_, i) => ({
      imageIndex: i,
      startTime: i * clipDuration,
      endTime: (i + 1) * clipDuration,
      transition: { type: 'fade', duration: 0.3 },
      motion: { type: 'static', intensity: 0.1 },
    }))
  }

  // 時間の正規化
  const totalTime = clips.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0)
  const scale = duration / totalTime

  let currentTime = 0
  return clips.map(clip => {
    const clipDuration = (clip.endTime - clip.startTime) * scale
    const newClip = {
      ...clip,
      startTime: currentTime,
      endTime: currentTime + clipDuration,
      imageIndex: Math.min(clip.imageIndex, imageCount - 1), // インデックスが範囲外にならないように
    }
    currentTime += clipDuration
    return newClip
  })
}
