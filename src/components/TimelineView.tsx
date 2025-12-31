'use client'

import { EditingPlan, UploadedImage } from '@/types'

interface Props {
  editingPlan: EditingPlan
  images: UploadedImage[]
  duration: number
}

export default function TimelineView({ editingPlan, images, duration }: Props) {
  const getTransitionIcon = (type: string) => {
    switch (type) {
      case 'fade': return '◐'
      case 'cut': return '|'
      case 'slide-left': return '←'
      case 'slide-right': return '→'
      case 'zoom': return '⊕'
      case 'dissolve': return '◑'
      default: return '•'
    }
  }

  const getMotionLabel = (type: string) => {
    switch (type) {
      case 'zoom-in': return '🔍+'
      case 'zoom-out': return '🔍-'
      case 'pan-left': return '←'
      case 'pan-right': return '→'
      case 'static': return '•'
      default: return ''
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🎬 タイムライン</h3>
        <div className="text-sm text-gray-500">
          {editingPlan.clips.length}クリップ / {duration.toFixed(1)}秒
        </div>
      </div>

      {/* ムードとタイトル */}
      <div className="mb-4 p-3 bg-primary-50 rounded-lg">
        <p className="text-sm text-primary-800">
          <span className="font-medium">ムード:</span> {editingPlan.overallMood}
          <span className="mx-2">|</span>
          <span className="font-medium">タイトル案:</span> {editingPlan.suggestedTitle}
        </p>
      </div>

      {/* タイムラインバー */}
      <div className="relative">
        <div className="flex h-24 bg-gray-100 rounded-lg overflow-hidden">
          {editingPlan.clips.map((clip, index) => {
            const width = ((clip.endTime - clip.startTime) / duration) * 100
            const image = images[clip.imageIndex]

            return (
              <div
                key={index}
                className="relative group"
                style={{ width: `${width}%` }}
              >
                {/* 画像サムネイル */}
                <div className="h-full relative overflow-hidden border-r border-white/50">
                  {image && (
                    <img
                      src={image.preview}
                      alt={`Clip ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* オーバーレイ情報 */}
                  <div className="absolute inset-0 bg-black/30 flex flex-col justify-between p-1.5">
                    {/* 上部: クリップ番号とモーション */}
                    <div className="flex justify-between items-start">
                      <span className="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                      </span>
                      <span className="bg-blue-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {getMotionLabel(clip.motion.type)}
                      </span>
                    </div>
                    
                    {/* 下部: 時間情報 */}
                    <div className="text-white text-xs text-center">
                      {clip.startTime.toFixed(1)}s - {clip.endTime.toFixed(1)}s
                    </div>
                  </div>
                </div>

                {/* トランジション表示 */}
                {index < editingPlan.clips.length - 1 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-xs border border-gray-200">
                      {getTransitionIcon(clip.transition.type)}
                    </div>
                  </div>
                )}

                {/* ホバー時の詳細 */}
                <div className="absolute inset-x-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-2 mx-1 shadow-lg">
                    <div><strong>画像:</strong> {image?.name || `Image ${clip.imageIndex + 1}`}</div>
                    <div><strong>トランジション:</strong> {clip.transition.type} ({clip.transition.duration}s)</div>
                    <div><strong>モーション:</strong> {clip.motion.type} (強度: {clip.motion.intensity})</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* タイムスケール */}
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0:00</span>
          <span>{formatTime(duration / 4)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration * 3 / 4)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* クリップ詳細リスト */}
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">クリップ詳細</h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {editingPlan.clips.map((clip, index) => {
            const image = images[clip.imageIndex]
            return (
              <div 
                key={index}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm"
              >
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  {image && (
                    <img 
                      src={image.preview} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {image?.name || `画像 ${clip.imageIndex + 1}`}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                    <span className="mx-1">•</span>
                    {clip.motion.type}
                    <span className="mx-1">•</span>
                    → {clip.transition.type}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
