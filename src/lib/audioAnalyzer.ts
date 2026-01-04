// 音源分析ユーティリティ（Web Audio API + 周波数帯域分析）

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
  type: 'drop' | 'climax' | 'transition' | 'buildup' | 'fillin' | 'drum_accent' | 'bass_accent' | 'high_accent'
  intensity: number
  source?: 'low' | 'mid' | 'high' | 'all'  // どの帯域で検出されたか
}

export interface FrequencyBandEvent {
  time: number
  band: 'low' | 'mid' | 'high'
  type: 'accent' | 'pattern_change' | 'intensity_spike'
  intensity: number
}

export interface AudioAnalysisResult {
  bpm: number
  beats: Beat[]
  sections: AudioSection[]
  highlights: AudioHighlight[]
  energy: number
  waveformData: number[]
  frequencyEvents: FrequencyBandEvent[]  // 周波数帯域イベント
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
  
  // 周波数帯域分析（新規追加）
  const frequencyEvents = await analyzeFrequencyBands(audioBuffer, startTime, actualEndTime)
  
  // ハイライト検出（周波数イベントも考慮）
  const highlights = detectHighlights(data, sampleRate, startTime, frequencyEvents)
  
  // 波形データ（プレビュー用に縮小）
  const waveformData = generateWaveformData(data, 200)
  
  return {
    bpm,
    beats,
    sections,
    highlights,
    energy,
    waveformData,
    frequencyEvents,
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

// ハイライト検出（強化版：周波数帯域イベントも統合）
function detectHighlights(
  data: Float32Array, 
  sampleRate: number,
  offsetTime: number,
  frequencyEvents: FrequencyBandEvent[] = []
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
        source: 'all',
      })
    }
  }
  
  // 周波数帯域イベントをハイライトに追加
  for (const event of frequencyEvents) {
    // 既存のハイライトと重複しなければ追加
    const hasNearby = highlights.some(h => Math.abs(h.time - event.time) < 0.3)
    if (!hasNearby) {
      let type: AudioHighlight['type'] = 'fillin'
      if (event.band === 'low') {
        type = 'drum_accent'
      } else if (event.band === 'high') {
        type = 'high_accent'
      } else if (event.band === 'mid') {
        type = 'bass_accent'
      }
      
      highlights.push({
        time: event.time,
        type,
        intensity: event.intensity,
        source: event.band,
      })
    }
  }
  
  // ビート密度変化を検出（フィルイン・ビルドアップ）
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
  if (variationRates.length > 0) {
    const avgVariation = variationRates.reduce((sum, v) => sum + v.rate, 0) / variationRates.length
    const stdVariation = Math.sqrt(
      variationRates.reduce((sum, v) => sum + Math.pow(v.rate - avgVariation, 2), 0) / variationRates.length
    )
    
    // 平均より大幅に高い変動率をフィルイン/ビルドアップとして検出
    for (const { time, rate } of variationRates) {
      if (rate > avgVariation + stdVariation * 1.5) {
        const hasNearbyHighlight = highlights.some(h => Math.abs(h.time - time) < 1)
        if (!hasNearbyHighlight) {
          const nextSecEnergy = smoothed[Math.min(Math.floor((time - offsetTime + 1) * 4), smoothed.length - 1)] || 0
          const currentSecEnergy = smoothed[Math.floor((time - offsetTime) * 4)] || 0
          
          highlights.push({
            time,
            type: nextSecEnergy > currentSecEnergy * 1.2 ? 'buildup' : 'fillin',
            intensity: Math.min(10, Math.round((rate - avgVariation) / stdVariation * 3)),
            source: 'all',
          })
        }
      }
    }
  }
  
  // ピークエネルギーの位置をクライマックスとして追加
  const maxEnergyIndex = smoothed.indexOf(Math.max(...smoothed))
  const climaxTime = offsetTime + (maxEnergyIndex * hopSize) / sampleRate
  
  const hasNearbyHighlight = highlights.some(h => Math.abs(h.time - climaxTime) < 2)
  if (!hasNearbyHighlight) {
    highlights.push({
      time: climaxTime,
      type: 'climax',
      intensity: 10,
      source: 'all',
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

// 周波数帯域分析（低音・中音・高音を分離してアクセントを検出）
async function analyzeFrequencyBands(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): Promise<FrequencyBandEvent[]> {
  const events: FrequencyBandEvent[] = []
  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0)
  
  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(endTime * sampleRate)
  const data = channelData.slice(startSample, endSample)
  
  // FFTサイズ（周波数分解能に影響）
  const fftSize = 2048
  const hopSize = fftSize / 4  // 75%オーバーラップ
  
  // 周波数帯域の定義（Hz）
  const bands = {
    low: { min: 20, max: 250 },      // ベース、キックドラム
    mid: { min: 250, max: 2000 },    // ボーカル、ギター、スネア
    high: { min: 2000, max: 16000 }, // ハイハット、シンバル、シンセの高音
  }
  
  // 各帯域のエネルギー履歴
  const bandEnergies: { low: number[], mid: number[], high: number[] } = {
    low: [],
    mid: [],
    high: [],
  }
  
  // 簡易FFT的な処理（周波数帯域ごとのエネルギーを計算）
  const frameCount = Math.floor((data.length - fftSize) / hopSize)
  
  for (let frame = 0; frame < frameCount; frame++) {
    const startIdx = frame * hopSize
    
    // 各帯域のエネルギーを計算（簡易的なバンドパスフィルタ）
    let lowEnergy = 0
    let midEnergy = 0
    let highEnergy = 0
    
    // 短時間の周波数成分を概算（ゼロ交差率で高周波を推定）
    let zeroCrossings = 0
    let totalEnergy = 0
    
    for (let i = 0; i < fftSize - 1; i++) {
      const sample = data[startIdx + i]
      const nextSample = data[startIdx + i + 1]
      totalEnergy += sample * sample
      
      // ゼロ交差をカウント
      if ((sample >= 0 && nextSample < 0) || (sample < 0 && nextSample >= 0)) {
        zeroCrossings++
      }
    }
    
    // ゼロ交差率から周波数帯域を推定
    const zcr = zeroCrossings / fftSize * sampleRate / 2
    const rmsEnergy = Math.sqrt(totalEnergy / fftSize)
    
    // 低周波成分の推定（ローパスフィルタ的な処理）
    let lowSum = 0
    let lowPrev = data[startIdx]
    const lowAlpha = 0.1  // ローパスフィルタ係数
    for (let i = 1; i < fftSize; i++) {
      lowPrev = lowAlpha * data[startIdx + i] + (1 - lowAlpha) * lowPrev
      lowSum += lowPrev * lowPrev
    }
    lowEnergy = Math.sqrt(lowSum / fftSize)
    
    // 高周波成分の推定（ハイパスフィルタ的な処理）
    let highSum = 0
    let highPrev = data[startIdx]
    const highAlpha = 0.9  // ハイパスフィルタ係数
    for (let i = 1; i < fftSize; i++) {
      const highFiltered = highAlpha * (highPrev + data[startIdx + i] - data[startIdx + i - 1])
      highSum += highFiltered * highFiltered
      highPrev = highFiltered
    }
    highEnergy = Math.sqrt(highSum / fftSize)
    
    // 中域は全体から低域と高域を引いた残り
    midEnergy = Math.max(0, rmsEnergy - lowEnergy * 0.5 - highEnergy * 0.5)
    
    bandEnergies.low.push(lowEnergy)
    bandEnergies.mid.push(midEnergy)
    bandEnergies.high.push(highEnergy)
  }
  
  // 各帯域で突発的なスパイクを検出
  const detectSpikes = (
    energies: number[],
    band: 'low' | 'mid' | 'high',
    threshold: number
  ) => {
    if (energies.length < 10) return
    
    // 移動平均を計算
    const windowSize = 8
    const smoothed: number[] = []
    for (let i = 0; i < energies.length; i++) {
      let sum = 0
      let count = 0
      for (let j = Math.max(0, i - windowSize); j <= Math.min(energies.length - 1, i + windowSize); j++) {
        sum += energies[j]
        count++
      }
      smoothed.push(sum / count)
    }
    
    // 標準偏差を計算
    const avg = smoothed.reduce((a, b) => a + b, 0) / smoothed.length
    const std = Math.sqrt(smoothed.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / smoothed.length)
    
    // スパイクを検出
    for (let i = 2; i < energies.length - 2; i++) {
      const current = energies[i]
      const prev = energies[i - 1]
      const prevPrev = energies[i - 2]
      
      // 急激な上昇を検出
      const increase = current - Math.max(prev, prevPrev)
      
      if (increase > std * threshold && current > avg * 1.5) {
        const time = startTime + (i * hopSize) / sampleRate
        
        // 近くに既にイベントがなければ追加
        const hasNearby = events.some(e => Math.abs(e.time - time) < 0.15)
        if (!hasNearby) {
          events.push({
            time: Math.round(time * 100) / 100,
            band,
            type: increase > std * 2 ? 'intensity_spike' : 'accent',
            intensity: Math.min(10, Math.round(increase / std * 3)),
          })
        }
      }
    }
  }
  
  // 各帯域でスパイク検出
  detectSpikes(bandEnergies.low, 'low', 1.2)   // 低音（ドラム）は敏感に
  detectSpikes(bandEnergies.mid, 'mid', 1.5)   // 中音
  detectSpikes(bandEnergies.high, 'high', 1.3) // 高音（ハイハット）も敏感に
  
  // 時間順にソート
  events.sort((a, b) => a.time - b.time)
  
  return events
}

// Web Audio APIでAudioBufferを取得
export async function loadAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  return await audioContext.decodeAudioData(arrayBuffer)
}