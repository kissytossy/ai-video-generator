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
  // dynamism関連
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
function getDurationRange(dynamism: number): { min: number; max: number } {
  if (dynamism >= 7) {
    // アップテンポ: 0.3秒〜3秒
    return { min: 0.3, max: 3.0 }
  } else {
    // スロー: 0.3秒〜5秒
    return { min: 0.3, max: 5.0 }
  }
}

// 躍動感スコアから理想的な表示時間を計算
function getIdealDuration(dynamism: number): number {
  if (dynamism >= 7) {
    // dynamism 7 → 1.5秒, dynamism 10 → 0.5秒
    return 3.0 - ((dynamism - 7) / 3) * 2.5
  } else {
    // dynamism 1 → 4秒, dynamism 6 → 1.5秒
    return 5.0 - ((dynamism - 1) / 5) * 3.5
  }
}

// 範囲内で最適なビートを選択
function findBestBeatInRange(
  beats: Array<{ time: number; strength: string }>,
  currentTime: number,
  minDuration: number,
  maxDuration: number,
  idealDuration: number,
  endLimit: number
): number | null {
  const minTime = currentTime + minDuration
  const maxTime = Math.min(currentTime + maxDuration, endLimit)
  const idealTime = currentTime + idealDuration
  
  // 範囲内のビートを取得
  const beatsInRange = beats.filter(b => b.time >= minTime && b.time <= maxTime)
  
  if (beatsInRange.length === 0) {
    // ビートがない場合は理想時間を返す（範囲内に収める）
    return Math.min(Math.max(idealTime, minTime), maxTime)
  }
  
  // strongビートを優先
  const strongBeats = beatsInRange.filter(b => b.strength === 'strong')
  const targetBeats = strongBeats.length > 0 ? strongBeats : beatsInRange
  
  // 理想時間に最も近いビートを選択
  let bestBeat = targetBeats[0]
  let minDiff = Math.abs(targetBeats[0].time - idealTime)
  
  for (const beat of targetBeats) {
    const diff = Math.abs(beat.time - idealTime)
    if (diff < minDiff) {
      minDiff = diff
      bestBeat = beat
    }
  }
  
  return bestBeat.time
}

// 画像の視覚的インパクトを計算
function getVisualImpact(analysis: ImageAnalysis): number {
  let impact = analysis.visualIntensity || 5
  
  // 表情がある場合はインパクト加算
  if (analysis.facialExpression && analysis.facialExpression !== 'なし') {
    if (['笑顔', '幸福', '情熱的'].includes(analysis.facialExpression)) {
      impact += 2
    } else if (['驚き', '真剣'].includes(analysis.facialExpression)) {
      impact += 1
    }
  }
  
  return Math.min(10, impact)
}

// クライマックスポイントを取得
function getClimaxPoints(audioAnalysis: AudioAnalysis, duration: number): number[] {
  const climaxPoints: number[] = []
  
  // highlightsからdrop/climaxを取得
  if (audioAnalysis.highlights) {
    for (const h of audioAnalysis.highlights) {
      if (h.type === 'drop' || h.type === 'climax') {
        climaxPoints.push(h.time)
      }
    }
  }
  
  // sectionsからchorusを取得
  if (audioAnalysis.sections) {
    for (const s of audioAnalysis.sections) {
      if (s.type === 'chorus' || s.type === 'drop') {
        climaxPoints.push(s.start)
      }
    }
  }
  
  return Array.from(new Set(climaxPoints)).sort((a, b) => a - b)
}

// 曲のムードに応じたトランジションを選択
function selectTransition(
  audioMood: string,
  isClimax: boolean,
  prevImageMood: string,
  nextImageMood: string
): { type: string; duration: number } {
  // クライマックスではダイナミックな効果
  if (isClimax) {
    const dynamicTransitions = ['zoom', 'slide-left', 'slide-right']
    return {
      type: dynamicTransitions[Math.floor(Math.random() * dynamicTransitions.length)],
      duration: 0.2
    }
  }
  
  // 曲のムードに応じたトランジション
  if (['calm', 'melancholic', 'romantic', 'peaceful'].includes(audioMood)) {
    return { type: 'fade', duration: 0.5 }
  } else if (['energetic', 'upbeat', 'intense'].includes(audioMood)) {
    return { type: 'cut', duration: 0 }
  } else {
    return { type: 'dissolve', duration: 0.3 }
  }
}

// モーションを選択
function selectMotion(
  dynamism: number,
  visualIntensity: number,
  motionSuggestion?: string
): { type: string; intensity: number } {
  // 提案があればそれを使用
  if (motionSuggestion && motionSuggestion !== 'static') {
    return {
      type: motionSuggestion,
      intensity: dynamism >= 7 ? 0.2 : 0.1
    }
  }
  
  // dynamismに応じたモーション
  if (dynamism >= 7) {
    // アップテンポ: 動きのあるモーション
    const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right']
    return {
      type: motions[Math.floor(Math.random() * motions.length)],
      intensity: 0.2
    }
  } else if (dynamism >= 4) {
    // 中程度: 緩やかなモーション
    return {
      type: Math.random() > 0.5 ? 'zoom-in' : 'zoom-out',
      intensity: 0.1
    }
  } else {
    // スロー: 静止または最小限のモーション
    return {
      type: Math.random() > 0.7 ? 'zoom-in' : 'static',
      intensity: 0.05
    }
  }
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
    console.log('Climax points:', climaxPoints)
    
    // 各画像の視覚的インパクトを計算
    const visualImpacts = imageAnalyses.map(getVisualImpact)
    
    // インパクトの高い画像のインデックスを取得（クライマックス用）
    const impactRanking = visualImpacts
      .map((impact, index) => ({ impact, index }))
      .sort((a, b) => b.impact - a.impact)
    
    // ビートリスト（時間順）
    const allBeats = [...audioAnalysis.beats].sort((a, b) => a.time - b.time)
    
    // 編集計画を生成
    let currentTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      const analysis = imageAnalyses[i]
      const dynamism = analysis.dynamism || 5
      const { min: minDuration, max: maxDuration } = getDurationRange(dynamism)
      const idealDuration = getIdealDuration(dynamism)
      
      // 最後の画像の場合は残り時間を使用
      if (i === imageCount - 1) {
        const endTime = duration
        const actualDuration = endTime - currentTime
        
        // 範囲内に収まっているか確認
        const clampedEndTime = Math.min(
          currentTime + maxDuration,
          endTime
        )
        
        clips.push({
          imageIndex: i,
          startTime: Math.round(currentTime * 100) / 100,
          endTime: Math.round(clampedEndTime * 100) / 100,
          transition: selectTransition(
            audioAnalysis.mood,
            false,
            i > 0 ? imageAnalyses[i - 1].mood : '',
            analysis.mood
          ),
          motion: selectMotion(dynamism, visualImpacts[i], analysis.motionSuggestion)
        })
        break
      }
      
      // 範囲内で最適なビートを探す
      const nextSwitchTime = findBestBeatInRange(
        allBeats,
        currentTime,
        minDuration,
        maxDuration,
        idealDuration,
        duration
      )
      
      if (nextSwitchTime === null) {
        // ビートが見つからない場合は理想時間を使用
        const endTime = Math.min(currentTime + idealDuration, duration)
        clips.push({
          imageIndex: i,
          startTime: Math.round(currentTime * 100) / 100,
          endTime: Math.round(endTime * 100) / 100,
          transition: selectTransition(
            audioAnalysis.mood,
            false,
            i > 0 ? imageAnalyses[i - 1].mood : '',
            analysis.mood
          ),
          motion: selectMotion(dynamism, visualImpacts[i], analysis.motionSuggestion)
        })
        currentTime = endTime
        continue
      }
      
      // クライマックスポイント付近かどうか確認
      const isNearClimax = climaxPoints.some(cp => 
        Math.abs(nextSwitchTime - cp) < 1.0
      )
      
      clips.push({
        imageIndex: i,
        startTime: Math.round(currentTime * 100) / 100,
        endTime: Math.round(nextSwitchTime * 100) / 100,
        transition: selectTransition(
          audioAnalysis.mood,
          isNearClimax,
          i > 0 ? imageAnalyses[i - 1].mood : '',
          analysis.mood
        ),
        motion: selectMotion(dynamism, visualImpacts[i], analysis.motionSuggestion)
      })
      
      currentTime = nextSwitchTime
    }
    
    // クリップが足りない場合の調整
    while (clips.length < imageCount) {
      const lastClip = clips[clips.length - 1]
      const remainingImages = imageCount - clips.length
      const remainingTime = duration - lastClip.endTime
      const avgTime = remainingTime / remainingImages
      
      for (let i = clips.length; i < imageCount; i++) {
        const analysis = imageAnalyses[i]
        const dynamism = analysis.dynamism || 5
        const startTime = clips[clips.length - 1].endTime
        const endTime = i === imageCount - 1 ? duration : startTime + avgTime
        
        clips.push({
          imageIndex: i,
          startTime: Math.round(startTime * 100) / 100,
          endTime: Math.round(endTime * 100) / 100,
          transition: selectTransition(audioAnalysis.mood, false, '', analysis.mood),
          motion: selectMotion(dynamism, visualImpacts[i], analysis.motionSuggestion)
        })
      }
    }
    
    // 最後のクリップのendTimeをdurationに合わせる
    if (clips.length > 0) {
      clips[clips.length - 1].endTime = duration
    }
    
    // ログ出力
    console.log('Generated clips:')
    clips.forEach((clip, i) => {
      const analysis = imageAnalyses[clip.imageIndex]
      const dynamism = analysis.dynamism || 5
      const clipDuration = clip.endTime - clip.startTime
      const range = getDurationRange(dynamism)
      console.log(`  Clip ${i}: ${clip.startTime.toFixed(2)}s - ${clip.endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | dynamism=${dynamism} | range=${range.min}-${range.max}s | ${clipDuration >= range.min && clipDuration <= range.max ? '✓' : '⚠️'}`)
    })

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