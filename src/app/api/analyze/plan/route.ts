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
    
    // ハイライト（曲調変化ポイント）を取得
    const highlights = audioAnalysis.highlights
      .filter(h => h.time <= duration)
      .map(h => ({ time: h.time, type: h.type, intensity: h.intensity }))
    
    // 切り替えポイント候補をstrongビートから選択
    const suggestedSwitchPoints = [0]
    if (strongBeats.length > imageCount) {
      // strongビートからランダムに選んで不均等にする
      const step = strongBeats.length / imageCount
      for (let i = 1; i < imageCount; i++) {
        // 少しずらして不均等に
        const baseIndex = Math.floor(i * step)
        const offset = (i % 2 === 0) ? -1 : 1
        const index = Math.max(0, Math.min(strongBeats.length - 1, baseIndex + offset))
        suggestedSwitchPoints.push(strongBeats[index])
      }
    } else {
      // strongビートが少ない場合は不均等に分割
      for (let i = 1; i < imageCount; i++) {
        const ratio = i / imageCount + (i % 2 === 0 ? 0.05 : -0.05)
        suggestedSwitchPoints.push(duration * ratio)
      }
    }
    suggestedSwitchPoints.push(duration)
    
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

### 曲調変化ポイント（重要！）
${highlights.length > 0 ? highlights.map(h => `${h.time.toFixed(1)}秒: ${h.type}（強度${h.intensity}）`).join('\n') : 'なし'}

※ buildup/fillin = サビ直前のドラムフィル、盛り上がりへの導入
※ drop/climax = サビ、最高潮のポイント
※ これらのポイント付近で画像を切り替えると効果的です

### 推奨切り替えタイミング（strongビート基準）
${suggestedSwitchPoints.map((t, i) => i < imageCount ? `画像${i + 1}: ${t.toFixed(2)}秒から` : '').filter(s => s).join('\n')}

**重要**: 
- 曲調変化ポイント付近で画像を切り替えてください
- 各クリップの長さは**必ず異なる**ようにしてください
- 均等分割は禁止です

## ルール

1. imageIndexは0から${imageCount - 1}の範囲
2. クリップは${imageCount}個
3. **各クリップの長さは異なること**（±0.5秒以上の差をつける）
4. トランジション: cut（デフォルト）, fade, dissolve, slide-left, slide-right, zoom
5. モーション: zoom-in, zoom-out, pan-left, pan-right, static

## 出力（JSONのみ）

{
  "clips": [
    {"imageIndex": 0, "startTime": 0, "endTime": ${suggestedSwitchPoints[1]?.toFixed(2) || (duration/imageCount).toFixed(2)}, "transition": {"type": "cut", "duration": 0}, "motion": {"type": "zoom-in", "intensity": 0.15}},
    ...残りのクリップ
  ],
  "overallMood": "雰囲気",
  "suggestedTitle": "タイトル"
}`

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
        if (editingPlan.clips && editingPlan.clips.length > 0) {
          // imageIndexが範囲外の場合は修正
          editingPlan.clips = editingPlan.clips.map((clip, i) => ({
            ...clip,
            imageIndex: Math.min(Math.max(0, clip.imageIndex), imageCount - 1)
          }))
          
          // 時間を正規化（常にduration内に収める）
          const lastClip = editingPlan.clips[editingPlan.clips.length - 1]
          const totalTime = lastClip.endTime
          
          // 時間をスケーリング
          if (totalTime > 0 && Math.abs(totalTime - duration) > 0.1) {
            const scale = duration / totalTime
            let currentTime = 0
            editingPlan.clips = editingPlan.clips.map(clip => {
              const clipDuration = (clip.endTime - clip.startTime) * scale
              const newClip = {
                ...clip,
                startTime: Math.round(currentTime * 100) / 100,
                endTime: Math.round((currentTime + clipDuration) * 100) / 100
              }
              currentTime += clipDuration
              return newClip
            })
            // 最後のクリップのendTimeを正確にdurationに設定
            editingPlan.clips[editingPlan.clips.length - 1].endTime = duration
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
  
  const transitions = ['cut', 'cut', 'cut', 'cut']
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right']
  
  for (let i = 0; i < imageCount; i++) {
    clips.push({
      imageIndex: i,
      startTime: switchPoints[i],
      endTime: switchPoints[i + 1],
      transition: {
        type: 'cut',
        duration: 0,
      },
      motion: {
        type: motions[i % motions.length],
        intensity: 0.15,
      },
    })
  }
  
  return {
    clips,
    overallMood: audioAnalysis.mood || 'energetic',
    suggestedTitle: 'AI Generated Video',
  }
}