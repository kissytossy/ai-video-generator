'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { UploadedImage, UploadedAudio, EditingPlan, AspectRatio } from '@/types'
import { PreviewRenderer, RESOLUTIONS } from '@/lib/videoRenderer'

interface Props {
  images: UploadedImage[]
  audio: UploadedAudio | null
  editingPlan: EditingPlan | null
  aspectRatio: AspectRatio
  startTime: number
  endTime: number
}

export default function VideoPreview({
  images,
  audio,
  editingPlan,
  aspectRatio,
  startTime,
  endTime,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const rendererRef = useRef<PreviewRenderer | null>(null)
  const animationRef = useRef<number | null>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(startTime)
  const [isReady, setIsReady] = useState(false)

  const duration = endTime - startTime

  // レンダラー初期化
  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new PreviewRenderer(canvasRef.current)
    rendererRef.current = renderer
    renderer.setAspectRatio(aspectRatio)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [aspectRatio])

  // 画像とプランが変更されたら更新
  useEffect(() => {
    const init = async () => {
      if (!rendererRef.current || images.length === 0) return
      
      setIsReady(false)
      await rendererRef.current.setImages(images)
      
      if (editingPlan) {
        rendererRef.current.setEditingPlan(editingPlan)
        setIsReady(true)
        // 初期フレームを描画
        rendererRef.current.renderFrame(startTime)
      }
    }
    
    init()
  }, [images, editingPlan, startTime])

  // 再生/一時停止
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !isReady) return

    if (isPlaying) {
      audioRef.current.pause()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    } else {
      audioRef.current.currentTime = currentTime
      audioRef.current.play()
      
      const startPlayTime = performance.now()
      const startVideoTime = currentTime

      const animate = () => {
        const elapsed = (performance.now() - startPlayTime) / 1000
        const newTime = startVideoTime + elapsed

        if (newTime >= endTime) {
          // 終了
          setCurrentTime(startTime)
          setIsPlaying(false)
          audioRef.current?.pause()
          rendererRef.current?.renderFrame(startTime)
          return
        }

        setCurrentTime(newTime)
        rendererRef.current?.renderFrame(newTime)
        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    setIsPlaying(!isPlaying)
  }, [isPlaying, currentTime, startTime, endTime, isReady])

  // シーク
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
    
    if (rendererRef.current && isReady) {
      rendererRef.current.renderFrame(time)
    }
  }, [isReady])

  // 時間フォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // アスペクト比に応じたコンテナスタイル
  const getContainerStyle = () => {
    const { width, height } = RESOLUTIONS[aspectRatio]
    const aspect = width / height
    
    if (aspect > 1) {
      // 横長
      return 'aspect-video max-w-full'
    } else if (aspect < 1) {
      // 縦長
      return 'aspect-[9/16] max-h-[500px]'
    } else {
      // 正方形
      return 'aspect-square max-h-[400px]'
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🎬 プレビュー</h3>
        {editingPlan && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            AI分析済み
          </span>
        )}
      </div>

      {/* キャンバスコンテナ */}
      <div className={`relative bg-gray-900 rounded-xl overflow-hidden mx-auto ${getContainerStyle()}`}>
        {!editingPlan ? (
          // プレースホルダー
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center p-8">
              <span className="text-4xl mb-2 block">🎥</span>
              <p className="text-sm">
                {images.length === 0 
                  ? '画像をアップロードしてください'
                  : 'AI分析を実行するとプレビューが表示されます'}
              </p>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
        )}

        {/* ローディングオーバーレイ */}
        {editingPlan && !isReady && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm">プレビューを準備中...</p>
            </div>
          </div>
        )}
      </div>

      {/* コントロール */}
      {editingPlan && isReady && (
        <div className="mt-4 space-y-3">
          {/* 再生コントロール */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{formatTime(currentTime - startTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={startTime}
                max={endTime}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
          </div>

          {/* クリップ情報 */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {editingPlan.clips.map((clip, index) => {
              const isActive = currentTime >= clip.startTime && currentTime < clip.endTime
              const clipDuration = clip.endTime - clip.startTime
              return (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentTime(clip.startTime)
                    rendererRef.current?.renderFrame(clip.startTime)
                  }}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="font-medium">画像 {clip.imageIndex + 1}</div>
                  <div className="text-gray-500">{clipDuration.toFixed(1)}秒</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 非表示のオーディオ要素 */}
      {audio && (
        <audio
          ref={audioRef}
          src={audio.url}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
}
