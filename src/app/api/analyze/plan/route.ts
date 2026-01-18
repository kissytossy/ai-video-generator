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
  dynamism?: number
}

interface AudioAnalysis {
  bpm: number
  genre: string
  mood: string
  energy: number
  beats: Array<{ time: number; strength: string }>
  sections: Array<{ start: number; end: number; type: string; energy: number }>
  highlights: Array<{ time: number; type: string; intensity: number }>
  switchPoints?: Array<{
    time: number
    reason: string
    intensity: number
    suggestedTransition: string
    isRapid?: boolean
  }>
  rapidSections?: Array<{
    start: number
    end: number
    reason: string
    suggestedInterval: number
  }>
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
    
    // Claude APIで生成されたswitchPointsがあればそれを優先使用
    const aiSwitchPoints = audioAnalysis.switchPoints

    let suggestedSwitchPoints: number[] = [0]
    let switchPointDetails: Array<{ time: number; transition: string; intensity: number }> = []

    if (aiSwitchPoints && aiSwitchPoints.length >= imageCount - 1) {
      // Claude APIからのswitchPointsを使用
      console.log(`Using ${aiSwitchPoints.length} AI-generated switch points`)
      
      // 時間順にソートして必要な数だけ取得
      const sortedPoints = [...aiSwitchPoints].sort((a, b) => a.time - b.time)
      for (let i = 0; i < imageCount - 1 && i < sortedPoints.length; i++) {
        suggestedSwitchPoints.push(sortedPoints[i].time)
        switchPointDetails.push({
          time: sortedPoints[i].time,
          transition: sortedPoints[i].suggestedTransition,
          intensity: sortedPoints[i].intensity,
        })
      }
      suggestedSwitchPoints.push(duration)
    } else {
      // フォールバック: strongビートから選択
      const strongBeats = audioAnalysis.beats
        .filter(b => b.strength === 'strong' && b.time <= duration)
        .map(b => b.time)
      
      if (strongBeats.length > imageCount) {
        const step = strongBeats.length / imageCount
        for (let i = 1; i < imageCount; i++) {
          const baseIndex = Math.floor(i * step)
          const offset = (i % 2 === 0) ? -1 : 1
          const index = Math.max(0, Math.min(strongBeats.length - 1, baseIndex + offset))
          suggestedSwitchPoints.push(strongBeats[index])
        }
      } else {
        for (let i = 1; i < imageCount; i++) {
          const ratio = i / imageCount + (i % 2 === 0 ? 0.05 : -0.05)
          suggestedSwitchPoints.push(duration * ratio)
        }
      }
      suggestedSwitchPoints.push(duration)
    }
    
    // ハイライト（曲調変化ポイント）を取得
    const highlights = audioAnalysis.highlights
      .filter(h => h.time <= duration)
      .map(h => ({ time: h.time, type: h.type, intensity: h.intensity }))
    
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
          // クリップ数が画像枚数と一致しない場合はフォールバック
          if (editingPlan.clips.length !== imageCount) {
            console.log(`Clip count mismatch: got ${editingPlan.clips.length}, expected ${imageCount}. Using fallback.`)
            editingPlan = generateSimplePlan(imageAnalyses, audioAnalysis, duration)
          } else {
            // ★重要: imageIndexはユーザーの並び順を強制（0, 1, 2...の順）
            // Claude APIの提案は無視し、ユーザーが並べた順番を使う
            editingPlan.clips = editingPlan.clips.map((clip, i) => ({
              ...clip,
              imageIndex: i  // 常に順番通り
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
          throw new Error('No clips in response')
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
  
  // Claude APIで生成されたswitchPointsがあればそれを優先使用
  const aiSwitchPoints = audioAnalysis.switchPoints
  const rapidSections = audioAnalysis.rapidSections || []

  const switchPoints = [0]
  const transitionMap: Map<number, string> = new Map()
  
  // rapidSections内かどうかをチェックするヘルパー
  const isInRapidSection = (time: number): boolean => {
    return rapidSections.some(rs => time >= rs.start && time <= rs.end)
  }

  if (aiSwitchPoints && aiSwitchPoints.length >= imageCount - 1) {
    // Claude APIからのswitchPointsを使用
    const sortedPoints = [...aiSwitchPoints].sort((a, b) => a.time - b.time)
    for (let i = 0; i < imageCount - 1 && i < sortedPoints.length; i++) {
      switchPoints.push(sortedPoints[i].time)
      transitionMap.set(i + 1, sortedPoints[i].suggestedTransition)
    }
  } else {
    // フォールバック: strongビートから選択
    const strongBeats = audioAnalysis.beats
      .filter(b => b.strength === 'strong' && b.time <= duration)
      .map(b => b.time)
    
    if (strongBeats.length >= imageCount) {
      const step = Math.floor(strongBeats.length / imageCount)
      for (let i = 1; i < imageCount; i++) {
        switchPoints.push(strongBeats[i * step] || (duration * i / imageCount))
      }
    } else {
      for (let i = 1; i < imageCount; i++) {
        switchPoints.push(duration * i / imageCount)
      }
    }
  }
  switchPoints.push(duration)
  
  // ★修正: 最後のクリップが長すぎる場合は再分配
  const maxClipDuration = 8.0  // 最大8秒
  let needsRebalance = false
  
  for (let i = 0; i < imageCount; i++) {
    const clipDuration = switchPoints[i + 1] - switchPoints[i]
    if (clipDuration > maxClipDuration) {
      needsRebalance = true
      break
    }
  }
  
  if (needsRebalance) {
    // 平均的な長さで再分配（ただし少し変化をつける）
    const avgDuration = duration / imageCount
    let currentTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      // ±20%のバリエーション
      const variation = 0.8 + (Math.random() * 0.4)
      let clipDuration = avgDuration * variation
      
      // 最後のクリップは残り時間
      if (i === imageCount - 1) {
        clipDuration = duration - currentTime
      } else {
        // 残り時間が十分あることを確認
        const remainingImages = imageCount - i - 1
        const remainingTime = duration - currentTime - clipDuration
        if (remainingTime < remainingImages * 1.0) {
          // 残り時間が足りない場合は短くする
          clipDuration = Math.max(1.0, (duration - currentTime) / (remainingImages + 1))
        }
      }
      
      const endTime = Math.min(currentTime + clipDuration, duration)
      
      // rapidSection内ならcutを強制
      const isRapid = isInRapidSection(currentTime)
      const transition = isRapid ? 'cut' : (transitionMap.get(i) || 'cut')
      clips.push({
        imageIndex: i,
        startTime: Math.round(currentTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        transition: {
          type: transition,
          duration: transition === 'cut' ? 0 : 0.3,
        },
        motion: {
          type: ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'][i % 4],
          intensity: 0.15,
        },
      })
      
      currentTime = endTime
    }
  } else {
    // 元のswitchPointsを使用
    const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right']
    
    for (let i = 0; i < imageCount; i++) {
      // rapidSection内ならcutを強制
      const isRapid = isInRapidSection(switchPoints[i])
      const transition = isRapid ? 'cut' : (transitionMap.get(i) || 'cut')
      clips.push({
        imageIndex: i,
        startTime: switchPoints[i],
        endTime: switchPoints[i + 1],
        transition: {
          type: transition,
          duration: transition === 'cut' ? 0 : 0.3,
        },
        motion: {
          type: motions[i % motions.length],
          intensity: 0.15,
        },
      })
    }
  }
  
  return {
    clips,
    overallMood: audioAnalysis.mood || 'energetic',
    suggestedTitle: 'AI Generated Video',
  }
}