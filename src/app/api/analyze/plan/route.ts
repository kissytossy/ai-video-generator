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

// 切り替え候補ポイント（優先度付き）
interface SwitchCandidate {
  time: number
  priority: number  // 数字が大きいほど優先
  type: string
  reason: string
  isRapidSequence?: boolean  // 連続ビートの一部かどうか
}

// 躍動感スコアから表示時間の範囲を計算
// 音楽の状態（高エネルギー区間など）に応じて最小値を調整
function getDurationRange(dynamism: number, isHighEnergy: boolean = false): { min: number; max: number } {
  if (dynamism >= 7) {
    // アップテンポ: 0.3〜3秒（高エネルギー時は0.1秒まで）
    return { 
      min: isHighEnergy ? 0.1 : 0.3, 
      max: 3.0 
    }
  } else {
    // スロー: 0.3〜5秒（高エネルギー時は0.1秒まで）
    return { 
      min: isHighEnergy ? 0.1 : 0.3, 
      max: 5.0 
    }
  }
}

// 連続ビートパターンを検出
function detectRapidBeatSequences(
  beats: Array<{ time: number; strength: string }>,
  duration: number
): Array<{ start: number; end: number; interval: number; count: number }> {
  const sequences: Array<{ start: number; end: number; interval: number; count: number }> = []
  
  if (!beats || beats.length < 3) return sequences
  
  // strongビートのみを抽出
  const strongBeats = beats
    .filter(b => b.strength === 'strong' && b.time <= duration)
    .sort((a, b) => a.time - b.time)
  
  if (strongBeats.length < 3) return sequences
  
  // 連続する短い間隔（0.8秒以下）のビートを検出
  let sequenceStart = 0
  let sequenceCount = 1
  let lastInterval = 0
  
  for (let i = 1; i < strongBeats.length; i++) {
    const interval = strongBeats[i].time - strongBeats[i - 1].time
    
    // 短い間隔（0.1〜0.8秒）で一定のリズム
    if (interval >= 0.1 && interval <= 0.8) {
      if (sequenceCount === 1) {
        sequenceStart = i - 1
        lastInterval = interval
        sequenceCount = 2
      } else if (Math.abs(interval - lastInterval) < 0.15) {
        // 前の間隔と近い場合は連続とみなす
        sequenceCount++
      } else {
        // リズムが変わった - 前のシーケンスを保存
        if (sequenceCount >= 3) {
          sequences.push({
            start: strongBeats[sequenceStart].time,
            end: strongBeats[i - 1].time,
            interval: lastInterval,
            count: sequenceCount
          })
        }
        sequenceStart = i - 1
        lastInterval = interval
        sequenceCount = 2
      }
    } else {
      // 間隔が長い - シーケンス終了
      if (sequenceCount >= 3) {
        sequences.push({
          start: strongBeats[sequenceStart].time,
          end: strongBeats[i - 1].time,
          interval: lastInterval,
          count: sequenceCount
        })
      }
      sequenceCount = 1
    }
  }
  
  // 最後のシーケンスを保存
  if (sequenceCount >= 3) {
    sequences.push({
      start: strongBeats[sequenceStart].time,
      end: strongBeats[strongBeats.length - 1].time,
      interval: lastInterval,
      count: sequenceCount
    })
  }
  
  return sequences
}

// ある時間が高エネルギー区間かどうかを判定
function isHighEnergyZone(
  time: number,
  sections: Array<{ start: number; end: number; type: string; energy: number }>,
  rapidSequences: Array<{ start: number; end: number; interval: number; count: number }>
): boolean {
  // 連続ビートシーケンス内
  for (const seq of rapidSequences) {
    if (time >= seq.start && time <= seq.end) {
      return true
    }
  }
  
  // 高エネルギーセクション内
  for (const section of sections) {
    if (time >= section.start && time <= section.end) {
      if (section.type === 'chorus' || section.type === 'drop' || section.energy >= 7) {
        return true
      }
    }
  }
  
  return false
}

// 音楽分析結果から全ての切り替え候補ポイントを抽出
function extractSwitchCandidates(
  audioAnalysis: AudioAnalysis, 
  duration: number,
  rapidSequences: Array<{ start: number; end: number; interval: number; count: number }>
): SwitchCandidate[] {
  const candidates: SwitchCandidate[] = []
  
  // 1. AI推奨ポイント（最高優先度）
  if (audioAnalysis.switchPoints) {
    for (const sp of audioAnalysis.switchPoints) {
      if (sp.time <= duration && sp.time > 0) {
        candidates.push({
          time: sp.time,
          priority: 100 + (sp.intensity || 5),
          type: 'ai-recommended',
          reason: sp.reason || 'AI推奨'
        })
      }
    }
  }
  
  // 2. セクション開始点
  if (audioAnalysis.sections) {
    for (const section of audioAnalysis.sections) {
      if (section.start <= duration && section.start > 0) {
        let priority = 50
        if (section.type === 'chorus' || section.type === 'drop') {
          priority = 90
        } else if (section.type === 'bridge') {
          priority = 70
        } else if (section.type === 'verse') {
          priority = 60
        }
        priority += (section.energy || 5)
        
        candidates.push({
          time: section.start,
          priority,
          type: 'section-start',
          reason: `${section.type}開始`
        })
      }
    }
  }
  
  // 3. ハイライト
  if (audioAnalysis.highlights) {
    for (const h of audioAnalysis.highlights) {
      if (h.time <= duration && h.time > 0) {
        let priority = 40
        if (h.type === 'drop' || h.type === 'climax') {
          priority = 85
        } else if (h.type === 'build') {
          priority = 65
        }
        priority += (h.intensity || 5)
        
        candidates.push({
          time: h.time,
          priority,
          type: 'highlight',
          reason: h.type
        })
      }
    }
  }
  
  // 4. ビート（連続シーケンス内のものは優先度を上げる）
  if (audioAnalysis.beats) {
    for (const beat of audioAnalysis.beats) {
      if (beat.time <= duration && beat.time > 0) {
        // 連続ビートシーケンス内かチェック
        const isInRapidSequence = rapidSequences.some(
          seq => beat.time >= seq.start && beat.time <= seq.end
        )
        
        let priority = beat.strength === 'strong' ? 30 : 10
        
        // 連続ビートシーケンス内なら優先度を大幅に上げる
        if (isInRapidSequence && beat.strength === 'strong') {
          priority = 75  // サビ開始より少し低いが、かなり高い
        }
        
        candidates.push({
          time: beat.time,
          priority,
          type: 'beat',
          reason: isInRapidSequence ? '連続ビート' : `${beat.strength}ビート`,
          isRapidSequence: isInRapidSequence
        })
      }
    }
  }
  
  // 時間順にソート
  candidates.sort((a, b) => a.time - b.time)
  
  return candidates
}

// 指定範囲内で最適な切り替えポイントを選択
function findBestSwitchPoint(
  candidates: SwitchCandidate[],
  minTime: number,
  maxTime: number
): SwitchCandidate | null {
  const inRange = candidates.filter(c => c.time >= minTime && c.time <= maxTime)
  
  if (inRange.length === 0) {
    return null
  }
  
  // 優先度が最も高いものを選択
  let best = inRange[0]
  for (const candidate of inRange) {
    if (candidate.priority > best.priority) {
      best = candidate
    }
  }
  
  return best
}

// トランジションを選択
function selectTransition(
  audioMood: string,
  switchReason: string,
  dynamism: number,
  isRapidSwitch: boolean
): { type: string; duration: number } {
  // 連続ビートでの高速切り替えはカット
  if (isRapidSwitch) {
    return { type: 'cut', duration: 0 }
  }
  
  // サビやドロップではダイナミックなトランジション
  if (switchReason.includes('chorus') || switchReason.includes('drop') || switchReason.includes('climax')) {
    const dynamicTransitions = ['zoom', 'slide-left', 'slide-right']
    return {
      type: dynamicTransitions[Math.floor(Math.random() * dynamicTransitions.length)],
      duration: 0.15
    }
  }
  
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
  // 非常に短いクリップ（0.5秒未満）は静止またはごく軽いズーム
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
    
    // Step 1: 連続ビートパターンを検出
    const rapidSequences = detectRapidBeatSequences(audioAnalysis.beats || [], duration)
    console.log('Rapid beat sequences:', rapidSequences.map(s => 
      `${s.start.toFixed(2)}-${s.end.toFixed(2)}s (interval=${s.interval.toFixed(2)}s, count=${s.count})`
    ))
    
    // Step 2: 音楽分析から全ての切り替え候補を抽出
    const switchCandidates = extractSwitchCandidates(audioAnalysis, duration, rapidSequences)
    
    // 高優先度の候補をログ
    const highPriorityCandidates = switchCandidates.filter(c => c.priority >= 50)
    console.log('High priority candidates:', highPriorityCandidates.length)
    
    // Step 3: セクション情報
    const sections = audioAnalysis.sections || []
    
    // Step 4: 各画像に対して切り替えポイントを決定
    let currentTime = 0
    
    for (let i = 0; i < imageCount; i++) {
      const analysis = imageAnalyses[i]
      const dynamism = analysis.dynamism || 5
      
      // 現在地点が高エネルギー区間かどうか
      const isHighEnergy = isHighEnergyZone(currentTime, sections, rapidSequences)
      const { min, max } = getDurationRange(dynamism, isHighEnergy)
      
      // 最後の画像
      if (i === imageCount - 1) {
        const remainingTime = duration - currentTime
        const clampedDuration = Math.max(min, Math.min(max, remainingTime))
        const endTime = currentTime + clampedDuration
        
        console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clampedDuration.toFixed(2)}s) | d=${dynamism} | LAST`)
        
        clips.push({
          imageIndex: i,
          startTime: Math.round(currentTime * 100) / 100,
          endTime: Math.round(endTime * 100) / 100,
          transition: selectTransition(audioAnalysis.mood, 'last', dynamism, false),
          motion: selectMotion(dynamism, clampedDuration, analysis.motionSuggestion)
        })
        break
      }
      
      // 切り替え候補を探す範囲
      const minEndTime = currentTime + min
      const maxEndTime = Math.min(currentTime + max, duration - 0.1)
      
      // 範囲内で最適な切り替えポイントを選択
      const bestSwitch = findBestSwitchPoint(switchCandidates, minEndTime, maxEndTime)
      
      let endTime: number
      let switchReason: string
      let isRapidSwitch = false
      
      if (bestSwitch) {
        endTime = bestSwitch.time
        switchReason = bestSwitch.reason
        isRapidSwitch = bestSwitch.isRapidSequence || false
        
        const clipDuration = endTime - currentTime
        console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | d=${dynamism} | range=${min.toFixed(1)}-${max}s | ${switchReason} (p=${bestSwitch.priority})${isRapidSwitch ? ' [RAPID]' : ''}`)
      } else {
        // 候補がない場合は範囲の中間点を使用
        endTime = Math.min(currentTime + (min + max) / 2, duration)
        switchReason = 'fallback'
        
        const clipDuration = endTime - currentTime
        console.log(`Clip ${i}: ${currentTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${clipDuration.toFixed(2)}s) | d=${dynamism} | range=${min.toFixed(1)}-${max}s | NO CANDIDATE`)
      }
      
      const clipDuration = endTime - currentTime
      
      clips.push({
        imageIndex: i,
        startTime: Math.round(currentTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        transition: selectTransition(audioAnalysis.mood, switchReason, dynamism, isRapidSwitch),
        motion: selectMotion(dynamism, clipDuration, analysis.motionSuggestion)
      })
      
      currentTime = endTime
      
      // 残り時間チェック
      const remainingImages = imageCount - i - 1
      const remainingTime = duration - currentTime
      if (remainingImages > 0 && remainingTime < remainingImages * 0.1) {
        console.log(`Warning: Not enough time for remaining ${remainingImages} images`)
        const avgTime = remainingTime / remainingImages
        for (let j = i + 1; j < imageCount; j++) {
          const jAnalysis = imageAnalyses[j]
          const jDynamism = jAnalysis.dynamism || 5
          const jEndTime = j === imageCount - 1 ? duration : currentTime + avgTime
          const jClipDuration = jEndTime - currentTime
          
          clips.push({
            imageIndex: j,
            startTime: Math.round(currentTime * 100) / 100,
            endTime: Math.round(jEndTime * 100) / 100,
            transition: { type: 'cut', duration: 0 },
            motion: selectMotion(jDynamism, jClipDuration, jAnalysis.motionSuggestion)
          })
          
          currentTime = jEndTime
        }
        break
      }
    }
    
    // 最後のクリップをdurationで終了
    if (clips.length > 0) {
      clips[clips.length - 1].endTime = Math.round(duration * 100) / 100
    }
    
    console.log('=== Plan Generation Complete ===')
    console.log('Total clips:', clips.length)

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