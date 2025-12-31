'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { UploadedAudio } from '@/types'

// wavesurfer.jsは動的インポート（SSR回避）
let WaveSurfer: typeof import('wavesurfer.js').default | null = null
let RegionsPlugin: typeof import('wavesurfer.js/dist/plugins/regions.js').default | null = null

interface Props {
  audio: UploadedAudio | null
  setAudio: (audio: UploadedAudio | null) => void
  onRangeChange?: (start: number, end: number) => void
}

export default function AudioUploader({ audio, setAudio, onRangeChange }: Props) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<any>(null)
  const activeRegionRef = useRef<any>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isWaveSurferReady, setIsWaveSurferReady] = useState(false)

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // WaveSurferを動的にロード
  useEffect(() => {
    const loadWaveSurfer = async () => {
      if (!WaveSurfer) {
        const ws = await import('wavesurfer.js')
        WaveSurfer = ws.default
      }
      if (!RegionsPlugin) {
        const regions = await import('wavesurfer.js/dist/plugins/regions.js')
        RegionsPlugin = regions.default
      }
      setIsWaveSurferReady(true)
    }
    loadWaveSurfer()
  }, [])

  // WaveSurfer初期化
  useEffect(() => {
    if (!waveformRef.current || !audio || !isWaveSurferReady || !WaveSurfer || !RegionsPlugin) return

    setIsLoading(true)

    // 既存のインスタンスを破棄
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
      wavesurferRef.current = null
    }

    // Regionsプラグイン作成
    const regions = RegionsPlugin.create()

    // WaveSurfer作成
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#cbd5e1',
      progressColor: '#0ea5e9',
      cursorColor: '#0284c7',
      cursorWidth: 2,
      height: 80,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      plugins: [regions],
    })

    wavesurferRef.current = wavesurfer

    // 音源読み込み
    wavesurfer.load(audio.url)

    // イベントリスナー
    wavesurfer.on('ready', () => {
      setIsLoading(false)
      const duration = wavesurfer.getDuration()
      setEndTime(duration)
      
      // 選択範囲のリージョンを追加
      const region = regions.addRegion({
        start: 0,
        end: duration,
        color: 'rgba(14, 165, 233, 0.2)',
        drag: false,
        resize: true,
      })
      activeRegionRef.current = region
    })

    wavesurfer.on('timeupdate', (time: number) => {
      setCurrentTime(time)
    })

    wavesurfer.on('play', () => setIsPlaying(true))
    wavesurfer.on('pause', () => setIsPlaying(false))
    wavesurfer.on('finish', () => setIsPlaying(false))

    // リージョンの更新イベント
    regions.on('region-updated', (region: any) => {
      setStartTime(region.start)
      setEndTime(region.end)
      onRangeChange?.(region.start, region.end)
    })

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
    }
  }, [audio?.url, isWaveSurferReady])

  // 範囲変更時のリージョン更新
  useEffect(() => {
    if (!activeRegionRef.current || !audio) return
    
    const region = activeRegionRef.current
    if (region.start !== startTime || region.end !== endTime) {
      region.setOptions({ start: startTime, end: endTime })
    }
    
    onRangeChange?.(startTime, endTime)
  }, [startTime, endTime])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 前のオーディオURLを解放
    if (audio?.url) {
      URL.revokeObjectURL(audio.url)
    }

    const url = URL.createObjectURL(file)
    const audioElement = new Audio(url)
    
    audioElement.addEventListener('loadedmetadata', () => {
      const newAudio: UploadedAudio = {
        id: generateId(),
        file,
        name: file.name,
        duration: audioElement.duration,
        url,
      }
      setAudio(newAudio)
      setStartTime(0)
      setEndTime(audioElement.duration)
      setCurrentTime(0)
    })
  }, [audio, setAudio])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('audio/')) return

    if (audio?.url) {
      URL.revokeObjectURL(audio.url)
    }

    const url = URL.createObjectURL(file)
    const audioElement = new Audio(url)
    
    audioElement.addEventListener('loadedmetadata', () => {
      const newAudio: UploadedAudio = {
        id: generateId(),
        file,
        name: file.name,
        duration: audioElement.duration,
        url,
      }
      setAudio(newAudio)
      setStartTime(0)
      setEndTime(audioElement.duration)
      setCurrentTime(0)
    })
  }, [audio, setAudio])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const removeAudio = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
      wavesurferRef.current = null
    }
    if (audio?.url) {
      URL.revokeObjectURL(audio.url)
    }
    setAudio(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setStartTime(0)
    setEndTime(0)
    activeRegionRef.current = null
  }, [audio, setAudio])

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
  }, [])

  const seekTo = useCallback((time: number) => {
    if (!wavesurferRef.current || !audio) return
    const progress = time / audio.duration
    wavesurferRef.current.seekTo(progress)
    setCurrentTime(time)
  }, [audio])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🎵 音源</h3>
        {audio && (
          <button
            onClick={removeAudio}
            className="text-sm text-red-500 hover:text-red-700"
          >
            削除
          </button>
        )}
      </div>

      {!audio ? (
        // ドロップゾーン
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="drop-zone cursor-pointer"
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="audio-upload"
          />
          <label htmlFor="audio-upload" className="cursor-pointer">
            <span className="text-4xl mb-2 block">🎧</span>
            <p className="text-gray-600 mb-1">
              ドラッグ&ドロップ または クリックで音源を追加
            </p>
            <p className="text-sm text-gray-400">
              MP3, WAV, AAC, OGG対応
            </p>
          </label>
        </div>
      ) : (
        // 音源プレイヤー
        <div className="space-y-4">
          {/* ファイル名 */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>📄</span>
            <span className="truncate">{audio.name}</span>
            <span className="text-gray-400">({formatTime(audio.duration)})</span>
          </div>

          {/* 波形表示 */}
          <div className="relative rounded-lg overflow-hidden bg-gray-50 min-h-[80px]">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>波形を読み込み中...</span>
                </div>
              </div>
            )}
            <div ref={waveformRef} className="w-full" />
          </div>

          {/* コントロール */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">
                {formatTime(currentTime)} / {formatTime(audio.duration)}
              </div>
              <input
                type="range"
                min={0}
                max={audio.duration}
                step={0.1}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
          </div>

          {/* 範囲選択 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              📏 動画の範囲を選択
              <span className="text-xs text-gray-500 ml-2">（波形の端をドラッグして調整可能）</span>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">開始</label>
                <input
                  type="range"
                  min={0}
                  max={audio.duration}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (val < endTime - 1) setStartTime(val)
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <span className="text-sm text-gray-600">{formatTime(startTime)}</span>
              </div>
              <div>
                <label className="text-xs text-gray-500">終了</label>
                <input
                  type="range"
                  min={0}
                  max={audio.duration}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (val > startTime + 1) setEndTime(val)
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <span className="text-sm text-gray-600">{formatTime(endTime)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-primary-600 font-medium">
                動画の長さ: {formatTime(endTime - startTime)}
              </p>
              <button
                onClick={() => {
                  setStartTime(0)
                  setEndTime(audio.duration)
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
