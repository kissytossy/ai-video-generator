'use client'

import { useState, useCallback } from 'react'
import { UploadedImage, UploadedAudio, EditingPlan, AspectRatio } from '@/types'
import { getVideoGenerator } from '@/lib/videoRenderer'

interface Props {
  images: UploadedImage[]
  audio: UploadedAudio
  editingPlan: EditingPlan
  aspectRatio: AspectRatio
  startTime: number
  endTime: number
  fps?: number
}

export default function VideoExporter({
  images,
  audio,
  editingPlan,
  aspectRatio,
  startTime,
  endTime,
  fps = 30,
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    setDownloadUrl(null)
    setProgress(0)
    setStatusMessage('FFmpegを読み込み中...')

    try {
      const generator = getVideoGenerator()
      
      // FFmpegをロード
      setIsLoading(true)
      await generator.load((msg) => setStatusMessage(msg))
      setIsLoading(false)

      // 動画を生成
      const videoBlob = await generator.generateVideo(
        images,
        audio.file,
        editingPlan,
        aspectRatio,
        startTime,
        endTime,
        fps,
        (message, prog) => {
          setStatusMessage(message)
          setProgress(prog)
        }
      )

      // ダウンロードURLを作成
      const url = URL.createObjectURL(videoBlob)
      setDownloadUrl(url)
      setStatusMessage('動画の生成が完了しました！')

    } catch (err) {
      console.error('Video generation failed:', err)
      setError(err instanceof Error ? err.message : '動画の生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }, [images, audio, editingPlan, aspectRatio, startTime, endTime, fps])

  const handleDownload = useCallback(() => {
    if (!downloadUrl) return

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `ai-video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [downloadUrl])

  const duration = endTime - startTime
  const estimatedTime = Math.ceil((duration * fps) / 10) // 大まかな見積もり

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🎬 動画を書き出す</h3>

      {/* 設定サマリー */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">解像度:</span>
            <span className="ml-2 font-medium">
              {aspectRatio === '16:9' && '1920×1080'}
              {aspectRatio === '9:16' && '1080×1920'}
              {aspectRatio === '1:1' && '1080×1080'}
              {aspectRatio === '4:5' && '1080×1350'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">FPS:</span>
            <span className="ml-2 font-medium">{fps}</span>
          </div>
          <div>
            <span className="text-gray-500">長さ:</span>
            <span className="ml-2 font-medium">{duration.toFixed(1)}秒</span>
          </div>
          <div>
            <span className="text-gray-500">クリップ数:</span>
            <span className="ml-2 font-medium">{editingPlan.clips.length}</span>
          </div>
        </div>
      </div>

      {/* 進捗表示 */}
      {isGenerating && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{statusMessage}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isLoading && (
            <p className="text-xs text-gray-500 mt-2">
              ※ 初回はFFmpegの読み込みに時間がかかります
            </p>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* 完了時のダウンロードボタン */}
      {downloadUrl && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <p className="text-green-700 font-medium">動画が完成しました！</p>
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ダウンロード
            </button>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
          isGenerating
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl'
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            生成中...
          </span>
        ) : downloadUrl ? (
          '🔄 もう一度生成する'
        ) : (
          '✨ 動画を生成する'
        )}
      </button>

      {!isGenerating && !downloadUrl && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          推定処理時間: 約{estimatedTime}秒〜{estimatedTime * 2}秒
        </p>
      )}

      {/* 注意事項 */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-700">
          ⚠️ 動画生成中はブラウザを閉じないでください。処理はすべてブラウザ内で行われます。
        </p>
      </div>
    </div>
  )
}
