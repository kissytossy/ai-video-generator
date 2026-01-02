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

    // ビートベースの編集計画を直接生成（高速で確実）
    const editingPlan = generateBeatBasedPlan(imageAnalyses, audioAnalysis, duration)

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

// ビートベースの編集計画を生成
function generateBeatBasedPlan(
  imageAnalyses: ImageAnalysis[],
  audioAnalysis: AudioAnalysis,
  duration: number
): EditingPlan {
  const imageCount = imageAnalyses.length
  const clips: Clip[] = []
  
  const bpm = audioAnalysis.bpm || 120
  const beatInterval = 60 / bpm
  
  // BPMに応じてクリップの長さを決定
  // BPM 200 → 4拍 = 1.2秒、8拍 = 2.4秒
  // BPM 120 → 4拍 = 2秒、8拍 = 4秒
  let beatsPerClip: number
  if (bpm > 160) {
    beatsPerClip = 8  // 高速BPMは8拍ごと
  } else if (bpm > 120) {
    beatsPerClip = 4  // 中速BPMは4拍ごと
  } else {
    beatsPerClip = 4  // 低速BPMも4拍ごと
  }
  
  const clipDuration = beatInterval * beatsPerClip
  
  // クリップ数を計算（最低でも画像数×2、または6個以上）
  const estimatedClips = Math.floor(duration / clipDuration)
  const minClips = Math.max(imageCount * 2, 6, estimatedClips)
  
  // 実際のクリップ時間を調整
  const actualClipDuration = Math.min(clipDuration, duration / minClips)
  
  console.log(`BPM: ${bpm}, beatsPerClip: ${beatsPerClip}, clipDuration: ${clipDuration.toFixed(2)}s, actualClipDuration: ${actualClipDuration.toFixed(2)}s`)
  
  const transitions = ['fade', 'cut', 'slide-left', 'slide-right', 'dissolve', 'zoom']
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']
  
  let currentTime = 0
  let clipIndex = 0
  
  while (currentTime < duration - 0.1) {
    const imageIndex = clipIndex % imageCount
    const analysis = imageAnalyses[imageIndex]
    
    let thisClipDuration = actualClipDuration
    
    // 残り時間を超えないように
    if (currentTime + thisClipDuration > duration) {
      thisClipDuration = duration - currentTime
    }
    
    // 最小0.3秒未満なら終了
    if (thisClipDuration < 0.3) break
    
    // トランジション選択（バリエーションを持たせる）
    let transition = transitions[clipIndex % transitions.length]
    
    // モーション選択
    let motion = analysis?.motionSuggestion || motions[clipIndex % motions.length]
    if (motion === 'static' && clipIndex % 2 === 0) {
      motion = 'zoom-in'
    }
    
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
        intensity: 0.1,
      },
    })
    
    currentTime += thisClipDuration
    clipIndex++
    
    // 無限ループ防止
    if (clipIndex > 100) break
  }
  
  console.log(`Generated ${clips.length} clips for ${duration.toFixed(1)}s video`)
  
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