'use client'

import { useState } from 'react'
import { EditingPlan, UploadedImage, EditingClip } from '@/types'

interface Props {
  editingPlan: EditingPlan
  images: UploadedImage[]
  duration: number
  onEditingPlanChange?: (plan: EditingPlan) => void
}

const TRANSITION_OPTIONS = [
  { value: 'none', label: 'なし', icon: '✕' },
  { value: 'cut', label: 'カット', icon: '|' },
  { value: 'fade', label: 'フェード', icon: '◐' },
  { value: 'dissolve', label: 'ディゾルブ', icon: '◑' },
  { value: 'slide-left', label: 'スライド←', icon: '←' },
  { value: 'slide-right', label: 'スライド→', icon: '→' },
  { value: 'zoom', label: 'ズーム', icon: '⊕' },
  { value: 'wipe', label: 'ワイプ', icon: '▶' },
]

const MOTION_OPTIONS = [
  { value: 'static', label: '静止', icon: '•' },
  { value: 'zoom-in', label: 'ズームイン', icon: '🔍+' },
  { value: 'zoom-out', label: 'ズームアウト', icon: '🔍-' },
  { value: 'pan-left', label: 'パン←', icon: '←' },
  { value: 'pan-right', label: 'パン→', icon: '→' },
]

export default function TimelineView({ editingPlan, images, duration, onEditingPlanChange }: Props) {
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null)

  const getTransitionIcon = (type: string) => {
    const option = TRANSITION_OPTIONS.find(o => o.value === type)
    return option?.icon || '•'
  }

  const getMotionLabel = (type: string) => {
    const option = MOTION_OPTIONS.find(o => o.value === type)
    return option?.icon || ''
  }

  const handleTransitionChange = (clipIndex: number, newType: string) => {
    if (!onEditingPlanChange) return
    
    const newClips = [...editingPlan.clips]
    newClips[clipIndex] = {
      ...newClips[clipIndex],
      transition: {
        ...newClips[clipIndex].transition,
        type: newType,
        duration: newType === 'none' || newType === 'cut' ? 0 : 0.3
      }
    }
    
    onEditingPlanChange({
      ...editingPlan,
      clips: newClips
    })
  }

  const handleMotionChange = (clipIndex: number, newType: string) => {
    if (!onEditingPlanChange) return
    
    const newClips = [...editingPlan.clips]
    newClips[clipIndex] = {
      ...newClips[clipIndex],
      motion: {
        ...newClips[clipIndex].motion,
        type: newType
      }
    }
    
    onEditingPlanChange({
      ...editingPlan,
      clips: newClips
    })
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
                className="relative group cursor-pointer"
                style={{ width: `${width}%` }}
                onClick={() => setEditingClipIndex(editingClipIndex === index ? null : index)}
              >
                {/* 画像サムネイル */}
                <div className={`h-full relative overflow-hidden border-r border-white/50 ${editingClipIndex === index ? 'ring-2 ring-primary-500' : ''}`}>
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
                    <div className={`w-6 h-6 rounded-full shadow-md flex items-center justify-center text-xs border ${
                      clip.transition.type === 'none' ? 'bg-gray-300 border-gray-400' : 'bg-white border-gray-200'
                    }`}>
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
                    <div className="mt-1 text-yellow-300">クリックして編集</div>
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

      {/* 選択中のクリップ編集パネル */}
      {editingClipIndex !== null && onEditingPlanChange && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              クリップ {editingClipIndex + 1} を編集
            </h4>
            <button
              onClick={() => setEditingClipIndex(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* トランジション選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                トランジション
              </label>
              <select
                value={editingPlan.clips[editingClipIndex].transition.type}
                onChange={(e) => handleTransitionChange(editingClipIndex, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {TRANSITION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* モーション選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                モーション
              </label>
              <select
                value={editingPlan.clips[editingClipIndex].motion.type}
                onChange={(e) => handleMotionChange(editingClipIndex, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {MOTION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* クリップ詳細リスト */}
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">クリップ詳細</h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {editingPlan.clips.map((clip, index) => {
            const image = images[clip.imageIndex]
            return (
              <div 
                key={index}
                className={`flex items-center gap-3 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  editingClipIndex === index 
                    ? 'bg-primary-100 border border-primary-300' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => setEditingClipIndex(editingClipIndex === index ? null : index)}
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
                    → {clip.transition.type === 'none' ? 'エフェクトなし' : clip.transition.type}
                  </div>
                </div>
                <div className="text-gray-400">
                  ✎
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
