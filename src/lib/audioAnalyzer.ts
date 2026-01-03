// 音源分析ユーティリティ（Web Audio API + 簡易ビート検出）

export interface Beat {
  time: number
  strength: 'strong' | 'weak'
}

export interface AudioSection {
  start: number
  end: number
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro'
  energy: number
}

export interface AudioHighlight {
  time: number
  type: 'drop' | 'climax' | 'transition' | 'buildup' | 'fillin'
  intensity: number
}

export interface AudioAnalysisResult {
  bpm: number
  beats: Beat[]
  sections: AudioSection[]
  highlights: AudioHighlight[]
  energy: number
  waveformData: number[]
}

// 音源を分析してビート検出を行う
export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  startTime: number = 0,
  endTime?: number
): Promise<AudioAnalysisResult> {
  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0) // モノラルで分析
  
  const actualEndTime = endTime ?? audioBuffer.duration
  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(actualEndTime * sampleRate)
  
  // 分析対象のデータを抽出
  const data = channelData.slice(startSample, endSample)
  
  // BPM検出
  const bpm = detectBPM(data, sampleRate)
  
  // ビート検出
  const beats = detectBeats(data, sampleRate, bpm, startTime)
  
  // エネルギー計算
  const energy = calculateEnergy(data)
  
  // セクション検出（簡易版）
  const sections = detectSections(data, sampleRate, startTime, actualEndTime)
  
  // ハイライト検出
  const highlights = detectHighlights(data, sampleRate, startTime)
  
  // 波形データ（プレビュー用に縮小）
  const waveformData = generateWaveformData(data, 200)
  
  return {
    bpm,
    beats,
    sections,
    highlights,
    energy,
    waveformData,
  }
}

// BPM検出（自己相関法の簡易版）
function detectBPM(data: Float32Array, sampleRate: number): number {
  // エネルギーのピークを検出
  const frameSize = Math.floor(sampleRate * 0.02) // 20ms frames
  const hopSize = Math.floor(frameSize / 2)
  const energies: number[] = []
  
  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    let energy = 0
    for (let j = 0; j < frameSize; j++) {
      energy += data[i + j] * data[i + j]
    }
    energies.push(energy)
  }
  
  // ピーク検出
  const peaks: number[] = []
  const threshold = Math.max(...energies) * 0.3
  
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && 
        energies[i] > energies[i - 1] && 
        energies[i] > energies[i + 1]) {
      peaks.push(i)
    }
  }
  
  // ピーク間隔からBPMを推定
  if (peaks.length < 2) {
    return 120 // デフォルト
  }
  
  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1])
  }
  
  // 中央値を使用
  intervals.sort((a, b) => a - b)
  const medianInterval = intervals[Math.floor(intervals.length / 2)]
  
  const secondsPerBeat = (medianInterval * hopSize) / sampleRate
  const bpm = Math.round(60 / secondsPerBeat)
  
  // BPMを妥当な範囲に制限
  if (bpm < 60) return bpm * 2
  if (bpm > 200) return Math.round(bpm / 2)
  
  return bpm
}

// ビート検出
function detectBeats(
  data: Float32Array, 
  sampleRate: number, 
  bpm: number,
  offsetTime: number
): Beat[] {
  const secondsPerBeat = 60 / bpm
  const samplesPerBeat = Math.floor(sampleRate * secondsPerBeat)
  const beats: Beat[] = []
  
  // ビート位置でのエネルギーを計算
  const duration = data.length / sampleRate
  let beatTime = 0
  let beatIndex = 0
  
  while (beatTime < duration) {
    const sampleIndex = Math.floor(beatTime * sampleRate)
    
    // ビート周辺のエネルギーを計算
    const windowSize = Math.floor(sampleRate * 0.05) // 50ms window
    let energy = 0
    for (let i = Math.max(0, sampleIndex - windowSize); 
         i < Math.min(data.length, sampleIndex + windowSize); 
         i++) {
      energy += data[i] * data[i]
    }
    
    beats.push({
      time: offsetTime + beatTime,
      strength: beatIndex % 4 === 0 ? 'strong' : 'weak',
    })
    
    beatTime += secondsPerBeat
    beatIndex++
  }
  
  return beats
}

// エネルギー計算（0-10のスケール）
function calculateEnergy(data: Float32Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i]
  }
  const rms = Math.sqrt(sum / data.length)
  // RMSを0-10のスケールに変換
  return Math.min(10, Math.round(rms * 100))
}

// セクション検出（簡易版）
function detectSections(
  data: Float32Array, 
  sampleRate: number,
  startTime: number,
  endTime: number
): AudioSection[] {
  const duration = endTime - startTime
  const sections: AudioSection[] = []
  
  // 簡易的に等分割してエネルギーベースでセクションタイプを決定
  const numSections = Math.max(3, Math.min(6, Math.floor(duration / 15)))
  const sectionDuration = duration / numSections
  
  for (let i = 0; i < numSections; i++) {
    const sectionStart = i * sectionDuration
    const sectionEnd = (i + 1) * sectionDuration
    
    // このセクションのエネルギーを計算
    const startSample = Math.floor(sectionStart * sampleRate)
    const endSample = Math.floor(sectionEnd * sampleRate)
    const sectionData = data.slice(startSample, endSample)
    const energy = calculateEnergy(sectionData)
    
    // エネルギーに基づいてセクションタイプを決定
    let type: AudioSection['type']
    if (i === 0) {
      type = 'intro'
    } else if (i === numSections - 1) {
      type = 'outro'
    } else if (energy >= 7) {
      type = 'chorus'
    } else if (energy >= 4) {
      type = 'verse'
    } else {
      type = 'bridge'
    }
    
    sections.push({
      start: startTime + sectionStart,
      end: startTime + sectionEnd,
      type,
      energy,
    })
  }
  
  return sections
}

// ハイライト検出（強化版：フィルイン・ビルドアップ検出）
function detectHighlights(
  data: Float32Array, 
  sampleRate: number,
  offsetTime: number
): AudioHighlight[] {
  const highlights: AudioHighlight[] = []
  const frameSize = Math.floor(sampleRate * 0.5) // 500ms frames
  const hopSize = Math.floor(frameSize / 4)
  
  const energies: number[] = []
  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    let energy = 0
    for (let j = 0; j < frameSize; j++) {
      energy += data[i + j] * data[i + j]
    }
    energies.push(Math.sqrt(energy / frameSize))
  }
  
  // 移動平均を計算
  const windowSize = 8
  const smoothed: number[] = []
  for (let i = 0; i < energies.length; i++) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - windowSize); j < Math.min(energies.length, i + windowSize); j++) {
      sum += energies[j]
      count++
    }
    smoothed.push(sum / count)
  }
  
  // 急激なエネルギー上昇を検出（ドロップ・トランジション）
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prevEnergy = smoothed[i - 1]
    const currentEnergy = smoothed[i]
    const increase = currentEnergy - prevEnergy
    
    if (increase > 0.1 && currentEnergy > 0.3) {
      const time = offsetTime + (i * hopSize) / sampleRate
      highlights.push({
        time,
        type: increase > 0.2 ? 'drop' : 'transition',
        intensity: Math.min(10, Math.round(increase * 50)),
      })
    }
  }
  
  // ビート密度変化を検出（フィルイン・ビルドアップ）
  // 短いフレームでエネルギー変動の頻度を計算
  const shortFrameSize = Math.floor(sampleRate * 0.05) // 50ms
  const shortHopSize = Math.floor(shortFrameSize / 2)
  const shortEnergies: number[] = []
  
  for (let i = 0; i < data.length - shortFrameSize; i += shortHopSize) {
    let energy = 0
    for (let j = 0; j < shortFrameSize; j++) {
      energy += Math.abs(data[i + j])
    }
    shortEnergies.push(energy / shortFrameSize)
  }
  
  // 1秒ごとの「変動率」を計算（フィルインは変動が多い）
  const framesPerSecond = Math.floor(sampleRate / shortHopSize)
  const variationRates: { time: number; rate: number }[] = []
  
  for (let sec = 0; sec < Math.floor(data.length / sampleRate) - 1; sec++) {
    const startFrame = sec * framesPerSecond
    const endFrame = Math.min((sec + 1) * framesPerSecond, shortEnergies.length)
    
    let variations = 0
    for (let i = startFrame + 1; i < endFrame; i++) {
      variations += Math.abs(shortEnergies[i] - shortEnergies[i - 1])
    }
    
    variationRates.push({
      time: offsetTime + sec,
      rate: variations / (endFrame - startFrame)
    })
  }
  
  // 変動率の平均と標準偏差を計算
  const avgVariation = variationRates.reduce((sum, v) => sum + v.rate, 0) / variationRates.length
  const stdVariation = Math.sqrt(
    variationRates.reduce((sum, v) => sum + Math.pow(v.rate - avgVariation, 2), 0) / variationRates.length
  )
  
  // 平均より大幅に高い変動率をフィルイン/ビルドアップとして検出
  for (const { time, rate } of variationRates) {
    if (rate > avgVariation + stdVariation * 1.5) {
      // 既存のハイライトと重複しなければ追加
      const hasNearbyHighlight = highlights.some(h => Math.abs(h.time - time) < 1)
      if (!hasNearbyHighlight) {
        // 次の秒のエネルギーを見てビルドアップかフィルインか判定
        const nextSecEnergy = smoothed[Math.min(Math.floor((time - offsetTime + 1) * 4), smoothed.length - 1)] || 0
        const currentSecEnergy = smoothed[Math.floor((time - offsetTime) * 4)] || 0
        
        highlights.push({
          time,
          type: nextSecEnergy > currentSecEnergy * 1.2 ? 'buildup' : 'fillin',
          intensity: Math.min(10, Math.round((rate - avgVariation) / stdVariation * 3)),
        })
      }
    }
  }
  
  // ピークエネルギーの位置をクライマックスとして追加
  const maxEnergyIndex = smoothed.indexOf(Math.max(...smoothed))
  const climaxTime = offsetTime + (maxEnergyIndex * hopSize) / sampleRate
  
  // 既存のハイライトと重複しなければ追加
  const hasNearbyHighlight = highlights.some(h => Math.abs(h.time - climaxTime) < 2)
  if (!hasNearbyHighlight) {
    highlights.push({
      time: climaxTime,
      type: 'climax',
      intensity: 10,
    })
  }
  
  // 時間順にソート
  highlights.sort((a, b) => a.time - b.time)
  
  return highlights
}

// 波形データを生成（プレビュー用）
function generateWaveformData(data: Float32Array, numPoints: number): number[] {
  const blockSize = Math.floor(data.length / numPoints)
  const waveform: number[] = []
  
  for (let i = 0; i < numPoints; i++) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) {
      const idx = i * blockSize + j
      if (idx < data.length) {
        sum += Math.abs(data[idx])
      }
    }
    waveform.push(sum / blockSize)
  }
  
  // 正規化
  const max = Math.max(...waveform)
  return waveform.map(v => v / max)
}

// Web Audio APIでAudioBufferを取得
export async function loadAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  return await audioContext.decodeAudioData(arrayBuffer)
}