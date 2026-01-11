'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import AudioUploader from '@/components/AudioUploader'
import AspectRatioSelector from '@/components/AspectRatioSelector'
import AnalysisProgress from '@/components/AnalysisProgress'
import TimelineView from '@/components/TimelineView'
import VideoPreview from '@/components/VideoPreview'
import VideoExporter from '@/components/VideoExporter'
import ModeSelector, { GenerationMode } from '@/components/ModeSelector'
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis'
import { UploadedImage, UploadedAudio, AspectRatio } from '@/types'

export default function Home() {
  const [mode, setMode] = useState<GenerationMode>('manual')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [audio, setAudio] = useState<UploadedAudio | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [fps, setFps] = useState(30)
  const [showExporter, setShowExporter] = useState(false)
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false)
  const [musicGenerationStatus, setMusicGenerationStatus] = useState('')

  const {
    isAnalyzing,
    progress,
    currentStep,
    imageAnalyses,
    audioAnalysis,
    editingPlan,
    error,
    runFullAnalysis,
    runAutoAnalysis,
    reset,
    setEditingPlan,
  } = useVideoAnalysis()

  // 手動モード: 画像+音源が必要
  // 自動モード: 画像のみでOK
  const canGenerate = mode === 'manual' 
    ? images.length >= 2 && audio !== null
    : images.length >= 2

  const handleAnalyze = async () => {
    if (!canGenerate) return
    
    try {
      if (mode === 'manual' && audio) {
        // 手動モード: 従来の処理
        await runFullAnalysis(
          images,
          audio,
          startTime,
          endTime || audio.duration,
          aspectRatio
        )
      } else if (mode === 'auto') {
        // AI自動生成モード
        await handleAutoGeneration()
      }
    } catch (e) {
      console.error('Analysis failed:', e)
    }
  }

  // AI自動生成モードの処理
  const handleAutoGeneration = async () => {
    setIsGeneratingMusic(true)
    setMusicGenerationStatus('画像を分析中...')

    try {
      // 1. 画像をAI分析（最初の数枚を代表として分析）
      const imagesToAnalyze = images.slice(0, Math.min(5, images.length))
      const imageAnalysisResults = []

      for (let i = 0; i < imagesToAnalyze.length; i++) {
        setMusicGenerationStatus(`画像を分析中... (${i + 1}/${imagesToAnalyze.length})`)
        
        const formData = new FormData()
        formData.append('image', imagesToAnalyze[i].file)
        formData.append('index', String(i))
        formData.append('useAI', 'true')

        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          imageAnalysisResults.push(data.analysis)
        }
      }

      // 2. 画像分析結果から音楽プロンプトを生成
      const musicGenres = imageAnalysisResults.map(a => a.musicGenre).filter(Boolean)
      const musicMoods = imageAnalysisResults.map(a => a.musicMood).filter(Boolean)
      const musicTempos = imageAnalysisResults.map(a => a.musicTempo).filter(Boolean)
      const atmospheres = imageAnalysisResults.map(a => a.atmosphere).filter(Boolean)

      // 最も多いジャンル・ムード・テンポを選択
      const dominantGenre = getMostFrequent(musicGenres) || 'pop'
      const dominantMood = getMostFrequent(musicMoods) || 'uplifting'
      const dominantTempo = getMostFrequent(musicTempos) || 'medium'

      // 3. 曲の長さを計算
      const tempoMultiplier = dominantTempo === 'fast' ? 1.0 : dominantTempo === 'slow' ? 3.0 : 2.0
      const duration = Math.max(15, Math.min(120, images.length * tempoMultiplier))

      // 4. 音楽プロンプトを作成
      const prompt = `${dominantMood} ${dominantGenre} music, ${dominantTempo} tempo, ${atmospheres.join(', ')}`

      setMusicGenerationStatus('AIが曲を作成中...')

      // 5. Beatoven.aiで作曲リクエスト
      const composeResponse = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration,
          genre: dominantGenre,
          mood: dominantMood,
          tempo: dominantTempo,
        }),
      })

      if (!composeResponse.ok) {
        throw new Error('Failed to start composition')
      }

      const { taskId } = await composeResponse.json()

      // 6. 作曲完了をポーリング
      let trackUrl = null
      for (let i = 0; i < 60; i++) {  // 最大5分待機
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        setMusicGenerationStatus(`AIが曲を作成中... (${i * 5}秒経過)`)

        const statusResponse = await fetch(`/api/compose/status?taskId=${taskId}`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          if (statusData.status === 'completed' && statusData.trackUrl) {
            trackUrl = statusData.trackUrl
            break
          }
        }
      }

      if (!trackUrl) {
        throw new Error('Music generation timed out')
      }

      setMusicGenerationStatus('曲をダウンロード中...')

      // 7. 生成された曲をダウンロードしてaudio stateに設定
      const audioResponse = await fetch(trackUrl)
      const audioBlob = await audioResponse.blob()
      const audioFile = new File([audioBlob], 'ai-generated-music.mp3', { type: 'audio/mpeg' })

      // AudioContextで長さを取得
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioFile.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const generatedAudio: UploadedAudio = {
        id: 'ai-generated',
        file: audioFile,
        name: 'AI Generated Music',
        duration: audioBuffer.duration,
        preview: URL.createObjectURL(audioBlob),
      }

      setAudio(generatedAudio)
      setStartTime(0)
      setEndTime(audioBuffer.duration)

      setMusicGenerationStatus('動画を分析中...')

      // 8. 通常の分析フローを実行
      await runFullAnalysis(
        images,
        generatedAudio,
        0,
        audioBuffer.duration,
        aspectRatio
      )

    } catch (error) {
      console.error('Auto generation failed:', error)
      setMusicGenerationStatus('エラーが発生しました')
    } finally {
      setIsGeneratingMusic(false)
      setMusicGenerationStatus('')
    }
  }

  // 配列から最頻値を取得
  const getMostFrequent = (arr: string[]): string | null => {
    if (arr.length === 0) return null
    const counts: { [key: string]: number } = {}
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
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

          {/* モード選択 */}
          <ModeSelector mode={mode} setMode={(newMode) => {
            setMode(newMode)
            reset()
            setShowExporter(false)
            if (newMode === 'auto') {
              setAudio(null)
            }
          }} />

          {/* 音源アップロード（手動モードのみ表示） */}
          {mode === 'manual' && (
            <AudioUploader 
              audio={audio} 
              setAudio={handleAudioChange}
              onRangeChange={(start, end) => {
                setStartTime(start)
                setEndTime(end)
                reset()
                setShowExporter(false)
              }}
            />
          )}

          {/* AI生成中の表示 */}
          {isGeneratingMusic && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎵 AI作曲中</h3>
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-700">{musicGenerationStatus}</span>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                ※ 作曲には30秒〜2分程度かかります
              </p>
            </div>
          )}

          {/* 自動生成モードで生成された曲の表示 */}
          {mode === 'auto' && audio && !isGeneratingMusic && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎵 AI生成された曲</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-green-500">✓</span>
                <span className="text-gray-700">{audio.name}</span>
              </div>
              <audio 
                controls 
                src={audio.preview} 
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                長さ: {Math.floor(audio.duration / 60)}:{String(Math.floor(audio.duration % 60)).padStart(2, '0')}
              </p>
            </div>
          )}

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
              onEditingPlanChange={setEditingPlan}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={30} className="text-gray-900 bg-white">30 FPS（推奨）</option>
                <option value={24} className="text-gray-900 bg-white">24 FPS（映画風）</option>
                <option value={60} className="text-gray-900 bg-white">60 FPS（滑らか）</option>
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
                {mode === 'manual' && (
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
                )}
                {mode === 'auto' && (
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500">🤖</span>
                    <span className="text-gray-700">
                      音源: AIが自動生成
                    </span>
                  </li>
                )}
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
                  {mode === 'auto' && <li>🤖 曲: AI自動生成</li>}
                </ul>
              </div>
            )}

            {/* 分析/生成ボタン */}
            {!editingPlan ? (
              <button
                onClick={handleAnalyze}
                disabled={!canGenerate || isAnalyzing || isGeneratingMusic}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 mb-3 ${
                  canGenerate && !isAnalyzing && !isGeneratingMusic
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAnalyzing || isGeneratingMusic ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isGeneratingMusic ? 'AI作曲中...' : '分析中...'}
                  </span>
                ) : (
                  mode === 'auto' ? '🤖 AIで曲を作成 & 分析' : '🤖 AIで分析する'
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

            {/* 著作権・免責事項 */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">⚠️ ご利用にあたって</h4>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li>• <strong>PC専用</strong>（Chrome / Edge推奨）です。</li>
                <li>• スマホ・タブレットでは動作しません。</li>
                <li>• 音源は著作権に十分ご注意の上、自己責任でご使用ください。著作権侵害に関して当サービスは一切の責任を負いません。</li>
                <li>• 動画を生成した時点で、上記の免責事項に同意したものとみなします。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}