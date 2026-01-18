import { NextRequest, NextResponse } from 'next/server'

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
  facialExpression?: string
  emotionalImpact?: string
}

interface AudioAnalysis {
  bpm: number
  genre: string
  mood: string
  energy: number
  beats: Array<{ time: number; strength: string }>
  sections: Array<{ start: number; end: number; type: string; energy: number }>
  highlights: Array<{ time: number; type: string; intensity: number }>
  switchPoints?: Array<{ time: number; reason: string; intensity: number; suggestedTransition: string }>
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

// 躍動感スコアから表示時間の範囲を計算
function getDurationRange(dynamism: number): { min: number; max: number; ideal: number } {
  if (dynamism >= 7) {
    // アップテンポ: 0.8秒〜3秒
    const ideal = 2.5 - ((dynamism - 7) / 3) * 1.5  // 7→2秒, 10→1秒
    return { min: 0.8, max: 3.0, ideal: Math.max(0.8, Math.min(3.0, ideal)) }
  } else {
    // スロー: 1.5秒〜5秒
    const ideal = 4.5 - ((dynamism - 1) / 5) * 2.5  // 1→4秒, 6→2秒
    return { min: 1.5, max: 5.0, ideal: Math.max(1.5, Math.min(5.0, ideal)) }
  }
}

// 指定時間範囲内で最も近いstrongビートを探す
function findNearestStrongBeat(
  beats: Array<{ time: number; strength: string }>,
  targetTime: number,
  minTime: number,
  maxTime: number
): number | null {
  // 範囲内のstrongビートを取得
  const strongBeatsInRange = beats.filter(
    b => b.strength === 'strong' && b.time >= minTime && b.time <= maxTime
  )
  
  if (strongBeatsInRange.length > 0) {
    // targetTimeに最も近いstrongビートを返す
    let nearest = strongBeatsInRange[0]
    let minDiff = Math.abs(strongBeatsInRange[0].time - targetTime)
    for (const beat of strongBeatsInRange) {
      const diff = Math.abs(beat.time - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        nearest = beat
      }
    }
    return nearest.time
  }
  
  // strongビートがない場合は通常のビートを探す
  const beatsInRange = beats.filter(b => b.time >= minTime && b.time <= maxTime)
  if (beatsInRange.length > 0) {
    let nearest = beatsInRange[0]
    let minDiff = Math.abs(beatsInRange[0].time - targetTime)
    for (const beat of beatsInRange) {
      const diff = Math.abs(beat.time - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        nearest = beat
      }
    }
    return nearest.time
  }
  
  return null
}

// 曲のムードに応じたトランジションを選択
function selectTransition(
  audioMood: string,
  isClimax: boolean,
  dynamism: number
): { type: string; duration: number } {
  if (isClimax) {
    const dynamicTransitions = ['zoom', 'slide-left', 'slide-right']
    return {
      type: dynamicTransitions[Math.floor(Math.random() * dynamicTransitions.length)],
      duration: 0.2
    }
  }
  
  // dynamismとムードに応じたトランジション
  if (dynamism >= 7 || ['energetic', 'upbeat', 'intense'].includes(audioMood)) {
    return { type: 'cut', duration: 0 }
  } else if (['calm', 'melancholic', 'romantic', 'peaceful'].includes(audioMood)) {
    return { type: 'fade', duration: 0.4 }
  } else {
    return { type: 'dissolve', duration: 0.3 }
  }
}

// モーションを選択
function selectMotion(
  dynamism: number,
  motionSuggestion?: string
): { type: string; intensity: number } {
  if (motionSuggestion && motionSuggestion !== 'static') {
    return {
      type: motionSuggestion,
      intensity: dynamism >= 7 ? 0.15 : 0.1
    }
  }
  
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right']
  
  if (dynamism >= 7) {
    return {
      type: motions[Math.floor(Math.random() * motions.length)],
      intensity: 0.15
    }
  } else if (dynamism >= 4) {
    return {
      type: Math.random() > 0.5 ? 'zoom-in' : 'zoom-out',
      intensity: 0.1
    }
  } else {
    return {
      type: 'zoom-in',
      intensity: 0.05
    }
  }
}

// クライマックスポイントを取得
function getClimaxPoints(audioAnalysis: AudioAnalysis, duration: number): number[] {
  const climaxPoints: number[] = []
  
  if (audioAnalysis.highlights) {
    for (const h of audioAnalysis.highlights) {
      if ((h.type === 'drop' || h.type === 'climax') && h.time <= duration) {
        climaxPoints.push(h.time)
      }
    }
  }
  
  if (audioAnalysis.sections) {
    for (const s of audioAnalysis.sections) {
      if ((s.type === 'chorus' || s.type === 'drop') && s.start <= duration) {
        climaxPoints.push(s.start)
      }
    }
  }
  
  return Array.from(new Set(climaxPoints)).sort((a, b) => a - b)
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
    const clips: Clip[] = []
    
    // クライマックスポイントを取得
    const climaxPoints = getClimaxPoints(audioAnalysis, duration)
    
    // ビートリスト（時間順）
    const allBeats = audioAnalysis.beats ? [...audioAnalysis.beats].sort((a, b) => a.time - b.time) : []
    
    console.log('=== Plan Generation Start ===')
    console.log('Duration:', duration, 'seconds')
    console.log('Image count:', imageCount)
    console.log('Beat count:', allBeats.length)
    
    // Step 1: 各画像のdynamismに基づく理想的な表示時間を計算
    const imageRanges: { min: number; max: number; ideal: number; dynamism: number }[] = []
    let totalIdealTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      const dynamism = imageAnalyses[i].dynamism || 5
      const range = getDurationRange(dynamism)
      imageRanges.push({ ...range, dynamism })
      totalIdealTime += range.ideal
    }
    
    console.log('Total ideal time:', totalIdealTime.toFixed(2), 'seconds')
    console.log('Requested duration:', duration, 'seconds')
    
    // Step 2: スケーリング係数を計算（durationに合わせる）
    const scale = duration / totalIdealTime
    console.log('Scale factor:', scale.toFixed(3))
    
    // Step 3: 各画像に時間を割り当て
    let currentTime = 0
    const allocatedDurations: number[] = []
    
    for (let i = 0; i < imageCount; i++) {
      const { min, max, ideal } = imageRanges[i]
      
      // スケーリングした時間を計算（範囲内に制限）
      let targetDuration = ideal * scale
      targetDuration = Math.max(min, Math.min(max, targetDuration))
      
      allocatedDurations.push(targetDuration)
    }
    
    // 合計を調整（丸め誤差を最後の画像で吸収）
    const totalAllocated = allocatedDurations.reduce((sum, d) => sum + d, 0)
    const adjustment = duration - totalAllocated
    
    // 調整を最後の画像に適用（範囲内で）
    const lastIdx = imageCount - 1
    const lastRange = imageRanges[lastIdx]
    allocatedDurations[lastIdx] = Math.max(
      lastRange.min, 
      Math.min(lastRange.max, allocatedDurations[lastIdx] + adjustment)
    )
    
    // Step 4: ビートに合わせて微調整しながらクリップを生成
    currentTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      const analysis = imageAnalyses[i]
      const { min, max, dynamism } = imageRanges[i]
      const targetDuration = allocatedDurations[i]
      
      let endTime = currentTime + targetDuration
      
      // ビートに合わせて微調整（±0.3秒以内）
      if (allBeats.length > 0 && i < imageCount - 1) {
        const minEndTime = Math.max(currentTime + min, endTime - 0.3)
        const maxEndTime = Math.min(currentTime + max, endTime + 0.3, duration)
        
        const nearestBeat = findNearestStrongBeat(allBeats, endTime, minEndTime, maxEndTime)
        if (nearestBeat !== null) {
          endTime = nearestBeat
        }
      }
      
      // 最後の画像は正確にdurationで終了
      if (i === imageCount - 1) {
        endTime = duration
      }
      
      // 範囲内に収める
      const actualDuration = endTime - currentTime
      if (actualDuration < min) {
        endTime = currentTime + min
      } else if (actualDuration > max && i < imageCount - 1) {
        endTime = currentTime + max
      }
      
      // クライマックス付近かチェック
      const isNearClimax = climaxPoints.some(cp => Math.abs(currentTime - cp) < 1.0)
      
      const clipDuration = endTime - currentTime
      const inRange = clipDuration >= min && clipDuration <= max
      console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | d=${dynamism} | range=${min}-${max}s | ${inRange ? '✓' : '⚠️'}`)
      
      clips.push({
        imageIndex: i,
        startTime: Math.round(currentTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        transition: selectTransition(audioAnalysis.mood, isNearClimax, dynamism),
        motion: selectMotion(dynamism, analysis.motionSuggestion)
      })
      
      currentTime = endTime
    }
    
    console.log('=== Plan Generation Complete ===')

    const editingPlan: EditingPlan = {
      clips,
      overallMood: audioAnalysis.mood || 'energetic',
      suggestedTitle: 'AI Generated Video',
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