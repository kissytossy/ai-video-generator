'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import AudioUploader from '@/components/AudioUploader'
import AspectRatioSelector from '@/components/AspectRatioSelector'
import AnalysisProgress from '@/components/AnalysisProgress'
import TimelineView from '@/components/TimelineView'
import VideoPreview from '@/components/VideoPreview'
import VideoExporter from '@/components/VideoExporter'
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis'
import { UploadedImage, UploadedAudio, AspectRatio } from '@/types'

export default function Home() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [audio, setAudio] = useState<UploadedAudio | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [fps, setFps] = useState(30)
  const [showExporter, setShowExporter] = useState(false)

  const {
    isAnalyzing,
    progress,
    currentStep,
    imageAnalyses,
    audioAnalysis,
    editingPlan,
    error,
    runFullAnalysis,
    reset,
  } = useVideoAnalysis()

  const canGenerate = images.length >= 2 && audio !== null

  const handleAnalyze = async () => {
    if (!canGenerate || !audio) return
    
    try {
      await runFullAnalysis(
        images,
        audio,
        startTime,
        endTime || audio.duration,
        aspectRatio
      )
    } catch (e) {
      console.error('Analysis failed:', e)
    }
  }

  // AudioUploaderから範囲選択を受け取るためのラッパー
  const handleAudioChange = (newAudio: UploadedAudio | null) => {
    setAudio(newAudio)
    if (newAudio) {
      setStartTime(0)
      setEndTime(newAudio.duration)
    }
    // 音源が変わったら分析結果をリセット
    reset()
    setShowExporter(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 分析プログレス */}
      <AnalysisProgress
        isAnalyzing={isAnalyzing}
        progress={progress}
        currentStep={currentStep}
        error={error}
      />

      {/* ヒーローセクション */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          画像と音楽から<span className="text-primary-600">自動で動画</span>を作成
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          複数の画像と音源をアップロードするだけで、AIが最適なタイミングと
          トランジションで動画を生成します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左カラム: プレビューエリア */}
        <div className="lg:col-span-2 space-y-6">
          {/* プレビュー - 分析完了後はVideoPreviewを表示 */}
          {editingPlan ? (
            <VideoPreview
              images={images}
              audio={audio}
              editingPlan={editingPlan}
              aspectRatio={aspectRatio}
              startTime={startTime}
              endTime={endTime || audio?.duration || 0}
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">プレビュー</h3>
              <div 
                className={`bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden ${
                  aspectRatio === '16:9' ? 'aspect-video' :
                  aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[500px] mx-auto' :
                  aspectRatio === '1:1' ? 'aspect-square max-h-[400px] mx-auto' :
                  'aspect-[4/5] max-h-[500px] mx-auto'
                }`}
              >
                {images.length > 0 ? (
                  <img 
                    src={images[0].preview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500 text-center p-8">
                    <span className="text-4xl mb-2 block">🎥</span>
                    <p>画像をアップロードするとプレビューが表示されます</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 音源アップロード */}
          <AudioUploader 
            audio={audio} 
            setAudio={handleAudioChange}
            onRangeChange={(start, end) => {
              setStartTime(start)
              setEndTime(end)
              reset() // 範囲が変わったら分析結果をリセット
              setShowExporter(false)
            }}
          />

          {/* 画像アップロード */}
          <ImageUploader 
            images={images} 
            setImages={setImages}
          />

          {/* タイムライン（分析完了後に表示） */}
          {editingPlan && (
            <TimelineView 
              editingPlan={editingPlan}
              images={images}
              duration={(endTime || audio?.duration || 0) - startTime}
            />
          )}

          {/* 動画エクスポーター（分析完了後に表示） */}
          {showExporter && editingPlan && audio && (
            <VideoExporter
              images={images}
              audio={audio}
              editingPlan={editingPlan}
              aspectRatio={aspectRatio}
              startTime={startTime}
              endTime={endTime || audio.duration}
              fps={fps}
            />
          )}
        </div>

        {/* 右カラム: コントロールパネル */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">設定</h3>
            
            {/* アスペクト比選択 */}
            <AspectRatioSelector 
              selected={aspectRatio} 
              onChange={(ratio) => {
                setAspectRatio(ratio)
                reset()
                setShowExporter(false)
              }} 
            />

            {/* FPS選択 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎬 フレームレート
              </label>
              <select 
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={30}>30 FPS（推奨）</option>
                <option value={24}>24 FPS（映画風）</option>
                <option value={60}>60 FPS（滑らか）</option>
              </select>
            </div>

            {/* ステータス表示 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">準備状況</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {images.length >= 2 ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                  <span className={images.length >= 2 ? 'text-gray-900' : 'text-gray-500'}>
                    画像: {images.length}枚（2枚以上必要）
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  {audio ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                  <span className={audio ? 'text-gray-900' : 'text-gray-500'}>
                    音源: {audio ? audio.name : '未選択'}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  {editingPlan ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                  <span className={editingPlan ? 'text-gray-900' : 'text-gray-500'}>
                    AI分析: {editingPlan ? '完了' : '未実行'}
                  </span>
                </li>
              </ul>
            </div>

            {/* 分析結果サマリー */}
            {imageAnalyses && audioAnalysis && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">✨ 分析結果</h4>
                <ul className="space-y-1 text-sm text-green-700">
                  <li>🎵 BPM: {audioAnalysis.bpm}</li>
                  <li>🎭 ムード: {audioAnalysis.mood}</li>
                  <li>⚡ エネルギー: {audioAnalysis.energy}/10</li>
                  <li>📸 画像: {imageAnalyses.length}枚分析済み</li>
                </ul>
              </div>
            )}

            {/* 分析/生成ボタン */}
            {!editingPlan ? (
              <button
                onClick={handleAnalyze}
                disabled={!canGenerate || isAnalyzing}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 mb-3 ${
                  canGenerate && !isAnalyzing
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    分析中...
                  </span>
                ) : (
                  '🤖 AIで分析する'
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowExporter(true)}
                disabled={showExporter}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 mb-3 ${
                  showExporter
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl'
                }`}
              >
                {showExporter ? '👇 下にスクロールして動画を生成' : '✨ 動画を生成する'}
              </button>
            )}

            {editingPlan && (
              <button
                onClick={() => {
                  reset()
                  setShowExporter(false)
                }}
                className="w-full py-2 px-4 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                🔄 再分析する
              </button>
            )}

            {/* プラン表示（Phase 7で実装） */}
            <div className="mt-6 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-800">
                <span className="font-semibold">Free プラン</span>: 残り 3/3 本
              </p>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Proにアップグレード →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
