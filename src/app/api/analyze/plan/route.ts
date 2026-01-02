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

    const imageCount = imageAnalyses.length
    
    // strongビートの位置を抽出（切り替えポイント候補）
    const strongBeats = audioAnalysis.beats
      .filter(b => b.strength === 'strong' && b.time <= duration)
      .map(b => b.time)
    
    // Claude APIで編集計画を生成
    const prompt = `
あなたは動画編集のプロフェッショナルです。音楽に合わせた動画編集計画を作成してください。

## 入力データ

### 画像（${imageCount}枚）
${imageAnalyses.map((img, i) => `画像${i + 1}: ${img.scene}, ${img.mood}, 強度${img.visualIntensity}/10`).join('\n')}

### 音源情報
- BPM: ${audioAnalysis.bpm}
- ジャンル: ${audioAnalysis.genre}
- ムード: ${audioAnalysis.mood}
- エネルギー: ${audioAnalysis.energy}/10
- 動画の長さ: ${duration.toFixed(1)}秒

### strongビートの位置（秒）
${strongBeats.slice(0, 30).map(t => t.toFixed(2)).join(', ')}${strongBeats.length > 30 ? '...' : ''}

## 重要なルール

1. **画像は${imageCount}枚のみ使用**してください。imageIndexは0から${imageCount - 1}の範囲です。
2. **クリップの数は${imageCount}個**にしてください（画像1枚につき1クリップ）。
3. **切り替えタイミングは曲調に合わせて**ください：
   - strongビートの位置で切り替えると自然です
   - 激しい部分は短く、穏やかな部分は長くしてください
   - 各クリップの長さは異なってOKです
4. **トランジション**は曲調に合わせて選んでください：
   - 激しい部分: cut（瞬時切り替え）
   - 穏やかな部分: fade, dissolve
   - 動きのある部分: slide-left, slide-right, zoom
5. **モーション**も曲調に合わせてください：
   - エネルギッシュな部分: zoom-in, pan-left, pan-right
   - 落ち着いた部分: static, zoom-out

## 出力形式（必ずこのJSON形式で）

{
  "clips": [
    {
      "imageIndex": 0,
      "startTime": 0,
      "endTime": （曲調に合わせた秒数）,
      "transition": { "type": "fade", "duration": 0.3 },
      "motion": { "type": "zoom-in", "intensity": 0.1 }
    },
    ...
  ],
  "overallMood": "（全体の雰囲気）",
  "suggestedTitle": "（タイトル案）"
}

JSONのみを出力してください。説明は不要です。`

    let editingPlan: EditingPlan

    try {
      const response = await callClaude(
        [{ role: 'user', content: prompt }],
        EDITING_PLAN_PROMPT
      )

      // JSONをパース
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        editingPlan = JSON.parse(jsonMatch[0])
        
        // クリップ数と画像インデックスを検証・修正
        if (editingPlan.clips) {
          // imageIndexが範囲外の場合は修正
          editingPlan.clips = editingPlan.clips.map((clip, i) => ({
            ...clip,
            imageIndex: Math.min(clip.imageIndex, imageCount - 1)
          }))
          
          // 時間を正規化（duration内に収める）
          const lastClip = editingPlan.clips[editingPlan.clips.length - 1]
          if (lastClip && lastClip.endTime !== duration) {
            const scale = duration / lastClip.endTime
            let currentTime = 0
            editingPlan.clips = editingPlan.clips.map(clip => {
              const clipDuration = (clip.endTime - clip.startTime) * scale
              const newClip = {
                ...clip,
                startTime: currentTime,
                endTime: currentTime + clipDuration
              }
              currentTime += clipDuration
              return newClip
            })
          }
        }
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse editing plan:', parseError)
      // フォールバック: シンプルな編集計画を生成
      editingPlan = generateSimplePlan(imageAnalyses, audioAnalysis, duration)
    }

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

// フォールバック用のシンプルな編集計画（画像枚数分のクリップ）
function generateSimplePlan(
  imageAnalyses: ImageAnalysis[],
  audioAnalysis: AudioAnalysis,
  duration: number
): EditingPlan {
  const imageCount = imageAnalyses.length
  const clips: Clip[] = []
  
  // strongビートを取得して切り替えポイントを決定
  const strongBeats = audioAnalysis.beats
    .filter(b => b.strength === 'strong' && b.time <= duration)
    .map(b => b.time)
  
  // 画像枚数に応じた切り替えポイントを選択
  const switchPoints = [0]
  if (strongBeats.length >= imageCount) {
    // strongビートから等間隔で選択
    const step = Math.floor(strongBeats.length / imageCount)
    for (let i = 1; i < imageCount; i++) {
      switchPoints.push(strongBeats[i * step] || (duration * i / imageCount))
    }
  } else {
    // strongビートが少ない場合は時間で分割
    for (let i = 1; i < imageCount; i++) {
      switchPoints.push(duration * i / imageCount)
    }
  }
  switchPoints.push(duration)
  
  const transitions = ['fade', 'cut', 'slide-left', 'dissolve']
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right']
  
  for (let i = 0; i < imageCount; i++) {
    clips.push({
      imageIndex: i,
      startTime: switchPoints[i],
      endTime: switchPoints[i + 1],
      transition: {
        type: i === 0 ? 'fade' : transitions[i % transitions.length],
        duration: 0.3,
      },
      motion: {
        type: motions[i % motions.length],
        intensity: 0.1,
      },
    })
  }
  
  return {
    clips,
    overallMood: audioAnalysis.mood || 'energetic',
    suggestedTitle: 'AI Generated Video',
  }
}