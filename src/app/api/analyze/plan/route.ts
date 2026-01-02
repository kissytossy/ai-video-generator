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
- セクション: ${audioAnalysis.sections.map(s => \`\${s.type}(\${s.start.toFixed(1)}s-\${s.end.toFixed(1)}s, エネルギー:\${s.energy})\`).join(', ')}

### 出力設定
- 動画の長さ: ${duration.toFixed(1)}秒
- アスペクト比: ${aspectRatio}

### 重要な指示
1. 各クリップは${(60 / audioAnalysis.bpm * 4).toFixed(2)}秒（4拍）から${(60 / audioAnalysis.bpm * 8).toFixed(2)}秒（8拍）程度で切り替えてください
2. BPMが${audioAnalysis.bpm}なので、テンポに合わせたリズミカルな切り替えを意識してください
3. セクションの変わり目（特にサビへの移行）では必ず画像を切り替えてください
4. すべての画像を均等に使用してください
5. 動画全体で${Math.max(6, Math.floor(duration / 3))}〜${Math.floor(duration / 2)}個のクリップを生成してください

上記の情報を基に、音楽のリズムに合わせた最適な編集計画を生成してください。
`

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
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse editing plan:', parseError)
      // フォールバック: ビートベースの編集計画を生成
      editingPlan = generateBeatBasedPlan(imageAnalyses, audioAnalysis, duration)
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

// ビートベースの編集計画を生成（フォールバック用）
function generateBeatBasedPlan(
  imageAnalyses: ImageAnalysis[],
  audioAnalysis: AudioAnalysis,
  duration: number
): EditingPlan {
  const imageCount = imageAnalyses.length
  const clips: Clip[] = []
  
  const bpm = audioAnalysis.bpm || 120
  const beatInterval = 60 / bpm
  
  // 4拍または8拍ごとに切り替え（BPMに応じて調整）
  const beatsPerClip = bpm > 140 ? 8 : 4
  const clipDuration = beatInterval * beatsPerClip
  
  // 最小クリップ数を確保
  const minClips = Math.max(imageCount * 2, 6)
  const maxClipDuration = duration / minClips
  const actualClipDuration = Math.min(clipDuration, maxClipDuration)
  
  const transitions = ['fade', 'cut', 'slide-left', 'slide-right', 'dissolve']
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']
  
  let currentTime = 0
  let clipIndex = 0
  
  while (currentTime < duration) {
    const imageIndex = clipIndex % imageCount
    const analysis = imageAnalyses[imageIndex]
    
    // セクションに基づいて切り替えタイミングを調整
    let thisClipDuration = actualClipDuration
    const currentSection = audioAnalysis.sections.find(
      s => currentTime >= s.start && currentTime < s.end
    )
    const nextSection = audioAnalysis.sections.find(
      s => s.start > currentTime && s.start < currentTime + actualClipDuration
    )
    
    // 次のセクション境界で切り替え
    if (nextSection) {
      thisClipDuration = nextSection.start - currentTime
    }
    
    // 最小0.5秒
    thisClipDuration = Math.max(0.5, thisClipDuration)
    
    // 残り時間を超えないように
    if (currentTime + thisClipDuration > duration) {
      thisClipDuration = duration - currentTime
    }
    
    if (thisClipDuration < 0.3) break
    
    // トランジション選択
    let transition = transitions[clipIndex % transitions.length]
    if (currentSection?.type === 'chorus') {
      transition = 'cut' // サビではカット
    } else if (nextSection?.type === 'chorus') {
      transition = 'fade' // サビへの移行はフェード
    }
    
    // モーション選択
    let motion = analysis.motionSuggestion || motions[clipIndex % motions.length]
    const intensity = 0.1 + (analysis.visualIntensity / 100)
    
    clips.push({
      imageIndex,
      startTime: currentTime,
      endTime: currentTime + thisClipDuration,
      transition: {
        type: clipIndex === 0 ? 'fade' : transition,
        duration: transition === 'cut' ? 0 : 0.3,
      },
      motion: {
        type: motion,
        intensity: Math.min(0.15, intensity),
      },
    })
    
    currentTime += thisClipDuration
    clipIndex++
  }
  
  return {
    clips,
    overallMood: audioAnalysis.mood || 'energetic',
    suggestedTitle: 'AI Generated Video',
  }
}

// クリップの時間を正規化
function normalizeClips(clips: Clip[], duration: number, imageCount: number): Clip[] {
  if (!clips || clips.length === 0) {
    return generateDefaultClips(duration, imageCount)
  }

  // 時間の正規化
  const lastClip = clips[clips.length - 1]
  const totalTime = lastClip ? lastClip.endTime : 0
  
  if (totalTime <= 0) {
    return generateDefaultClips(duration, imageCount)
  }
  
  const scale = duration / totalTime

  let currentTime = 0
  return clips.map((clip, index) => {
    const clipDuration = (clip.endTime - clip.startTime) * scale
    const newClip = {
      ...clip,
      startTime: currentTime,
      endTime: currentTime + clipDuration,
      imageIndex: clip.imageIndex % imageCount,
    }
    currentTime += clipDuration
    return newClip
  })
}

function generateDefaultClips(duration: number, imageCount: number): Clip[] {
  const clipDuration = duration / Math.max(imageCount * 2, 6)
  const clips: Clip[] = []
  let currentTime = 0
  let index = 0
  
  while (currentTime < duration) {
    const actualDuration = Math.min(clipDuration, duration - currentTime)
    if (actualDuration < 0.3) break
    
    clips.push({
      imageIndex: index % imageCount,
      startTime: currentTime,
      endTime: currentTime + actualDuration,
      transition: { type: index === 0 ? 'fade' : 'cut', duration: 0.3 },
      motion: { type: 'zoom-in', intensity: 0.1 },
    })
    
    currentTime += actualDuration
    index++
  }
  
  return clips
}
