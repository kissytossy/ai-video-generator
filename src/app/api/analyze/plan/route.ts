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
  // 音楽分析APIで生成された切り替えポイント（最重要！）
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

// 躍動感スコアから表示時間の範囲を計算
function getDurationRange(dynamism: number): { min: number; max: number } {
  if (dynamism >= 7) {
    return { min: 0.3, max: 3.0 }
  } else {
    return { min: 0.3, max: 5.0 }
  }
}

// トランジションを選択
function selectTransition(
  suggestedTransition: string | undefined,
  isRapid: boolean,
  audioMood: string,
  dynamism: number
): { type: string; duration: number } {
  // 高速切り替えはカット
  if (isRapid) {
    return { type: 'cut', duration: 0 }
  }
  
  // 音楽分析APIの提案があればそれを使用
  if (suggestedTransition && suggestedTransition !== 'cut') {
    const transitionDurations: { [key: string]: number } = {
      'fade': 0.4,
      'dissolve': 0.3,
      'slide-left': 0.2,
      'slide-right': 0.2,
      'zoom': 0.15,
      'wipe': 0.25,
    }
    return { 
      type: suggestedTransition, 
      duration: transitionDurations[suggestedTransition] || 0.2 
    }
  }
  
  // フォールバック
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
  clipDuration: number,
  motionSuggestion?: string
): { type: string; intensity: number } {
  // 非常に短いクリップ（0.5秒未満）は静止
  if (clipDuration < 0.5) {
    return { type: 'static', intensity: 0 }
  }
  
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

// ビートからフォールバック用の切り替えポイントを生成
function generateFallbackSwitchPoints(
  beats: Array<{ time: number; strength: string }>,
  imageCount: number,
  duration: number
): Array<{ time: number; reason: string; intensity: number; suggestedTransition: string; isRapid: boolean }> {
  const switchPoints: Array<{ time: number; reason: string; intensity: number; suggestedTransition: string; isRapid: boolean }> = []
  
  const strongBeats = beats
    .filter(b => b.strength === 'strong' && b.time > 0 && b.time < duration)
    .sort((a, b) => a.time - b.time)
  
  if (strongBeats.length === 0) {
    // ビートがない場合は均等分割
    const interval = duration / imageCount
    for (let i = 1; i < imageCount; i++) {
      switchPoints.push({
        time: interval * i,
        reason: '均等分割',
        intensity: 5,
        suggestedTransition: 'cut',
        isRapid: false
      })
    }
    return switchPoints
  }
  
  // 必要な切り替え数
  const needed = imageCount - 1
  const avgInterval = duration / imageCount
  
  // 強拍から適切な間隔で選択
  let lastTime = 0
  for (let i = 0; i < needed; i++) {
    const targetTime = (i + 1) * avgInterval
    
    // targetTime付近の強拍を探す
    let bestBeat = strongBeats.find(b => b.time > lastTime + 0.2)
    let minDiff = Infinity
    
    for (const beat of strongBeats) {
      if (beat.time <= lastTime + 0.2) continue
      const diff = Math.abs(beat.time - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        bestBeat = beat
      }
    }
    
    if (bestBeat) {
      switchPoints.push({
        time: bestBeat.time,
        reason: '強拍に合わせた切り替え',
        intensity: 5,
        suggestedTransition: 'cut',
        isRapid: false
      })
      lastTime = bestBeat.time
    } else {
      // 強拍がない場合は目標時間を使用
      switchPoints.push({
        time: Math.min(targetTime, duration - 0.1),
        reason: 'フォールバック',
        intensity: 3,
        suggestedTransition: 'cut',
        isRapid: false
      })
      lastTime = targetTime
    }
  }
  
  return switchPoints
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
    
    console.log('=== Plan Generation Start ===')
    console.log('Duration:', duration, 'seconds')
    console.log('Image count:', imageCount)
    console.log('BPM:', audioAnalysis.bpm)
    console.log('Mood:', audioAnalysis.mood)
    
    // ★ 音楽分析APIで生成されたswitchPointsを優先使用
    let switchPoints = audioAnalysis.switchPoints || []
    
    console.log('Original switchPoints from audio analysis:', switchPoints.length)
    
    // switchPointsが足りない場合はフォールバックで補完
    if (switchPoints.length < imageCount - 1) {
      console.log(`Not enough switchPoints (${switchPoints.length}), generating fallback...`)
      switchPoints = generateFallbackSwitchPoints(
        audioAnalysis.beats || [],
        imageCount,
        duration
      )
    }
    
    // switchPointsを時間順にソート
    switchPoints = [...switchPoints].sort((a, b) => a.time - b.time)
    
    // 最初のimageCount-1個のみを使用
    switchPoints = switchPoints.slice(0, imageCount - 1)
    
    console.log('Using switchPoints:')
    switchPoints.forEach((sp, i) => {
      console.log(`  ${i}: ${sp.time.toFixed(2)}s - ${sp.reason} (intensity=${sp.intensity}, rapid=${sp.isRapid || false})`)
    })
    
    // rapidSections情報
    const rapidSections = audioAnalysis.rapidSections || []
    console.log('Rapid sections:', rapidSections.map(rs => `${rs.start.toFixed(1)}-${rs.end.toFixed(1)}s`).join(', ') || 'none')
    
    // クリップを生成
    let currentTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      const analysis = imageAnalyses[i]
      const dynamism = analysis.dynamism || 5
      const { min, max } = getDurationRange(dynamism)
      
      let endTime: number
      let switchPoint: typeof switchPoints[0] | undefined
      let clipDuration: number
      
      if (i < switchPoints.length) {
        // switchPointがある場合はそれを使用
        switchPoint = switchPoints[i]
        endTime = switchPoint.time
        
        // dynamism範囲を大幅に逸脱する場合のみ調整
        clipDuration = endTime - currentTime
        
        if (clipDuration < 0.1) {
          // 最小0.1秒を保証
          endTime = currentTime + 0.1
          clipDuration = 0.1
          console.log(`Clip ${i}: Adjusted from ${switchPoint.time.toFixed(2)}s to ${endTime.toFixed(2)}s (min 0.1s)`)
        } else if (clipDuration > max + 1.0) {
          // 範囲を大幅に超える場合のみ調整（1秒の余裕）
          endTime = currentTime + max
          clipDuration = max
          console.log(`Clip ${i}: Adjusted from ${switchPoint.time.toFixed(2)}s to ${endTime.toFixed(2)}s (max exceeded)`)
        }
        
        console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | d=${dynamism} | ${switchPoint.reason}${switchPoint.isRapid ? ' [RAPID]' : ''}`)
      } else {
        // 最後の画像
        endTime = duration
        clipDuration = endTime - currentTime
        
        // 最小時間を保証
        if (clipDuration < 0.1) {
          console.log(`Clip ${i}: LAST - duration too short (${clipDuration.toFixed(3)}s), skipping`)
          continue
        }
        
        console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | d=${dynamism} | LAST`)
      }
      
      // 現在時間がrapidSection内かチェック
      const isInRapidSection = rapidSections.some(
        rs => currentTime >= rs.start && currentTime <= rs.end
      )
      const isRapid = switchPoint?.isRapid || isInRapidSection
      
      clips.push({
        imageIndex: i,
        startTime: Math.round(currentTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        transition: selectTransition(
          switchPoint?.suggestedTransition,
          isRapid,
          audioAnalysis.mood,
          dynamism
        ),
        motion: selectMotion(dynamism, clipDuration, analysis.motionSuggestion)
      })
      
      currentTime = endTime
    }
    
    // 0秒クリップをフィルタリング
    const validClips = clips.filter(clip => {
      const dur = clip.endTime - clip.startTime
      if (dur < 0.1) {
        console.log(`Filtered out clip with duration ${dur.toFixed(3)}s`)
        return false
      }
      return true
    })
    
    // 最後のクリップを正確にdurationで終了
    if (validClips.length > 0) {
      validClips[validClips.length - 1].endTime = Math.round(duration * 100) / 100
    }
    
    console.log('=== Plan Generation Complete ===')
    console.log('Total clips:', validClips.length)
    
    // クリップの長さの分布をログ
    const durations = validClips.map(c => c.endTime - c.startTime)
    console.log('Clip durations:', durations.map(d => d.toFixed(2)).join(', '))

    const editingPlan: EditingPlan = {
      clips: validClips,
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