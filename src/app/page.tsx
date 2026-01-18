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
  const [withLyrics, setWithLyrics] = useState(false)

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
    setEditingPlan,
  } = useVideoAnalysis()

  const canGenerate = mode === 'manual' 
    ? images.length >= 2 && audio !== null
    : images.length >= 2

  const handleAnalyze = async () => {
    if (!canGenerate) return
    
    try {
      if (mode === 'manual' && audio) {
        await runFullAnalysis(
          images,
          audio,
          startTime,
          endTime || audio.duration,
          aspectRatio
        )
      } else if (mode === 'auto') {
        await handleAutoGeneration()
      }
    } catch (e) {
      console.error('Analysis failed:', e)
    }
  }

  // 躍動感スコアから表示時間を計算
  // 躍動感高い（dynamism >= 7）→ 0.3秒〜3秒
  // ゆったり系（dynamism < 7）→ 0.3秒〜5秒
  const calculateDisplayDuration = (dynamism: number): { min: number; max: number; base: number } => {
    if (dynamism >= 7) {
      // 躍動感が高い場合: 0.3秒〜3秒
      // dynamism 7 → 約1.5秒, dynamism 10 → 約0.5秒
      const base = 3.0 - ((dynamism - 7) / 3) * 2.5
      return { min: 0.3, max: 3.0, base: Math.max(0.3, Math.min(3.0, base)) }
    } else {
      // ゆったり系: 0.3秒〜5秒
      // dynamism 1 → 約4秒, dynamism 6 → 約1.5秒
      const base = 5.0 - ((dynamism - 1) / 5) * 3.5
      return { min: 0.3, max: 5.0, base: Math.max(0.3, Math.min(5.0, base)) }
    }
  }

  const handleAutoGeneration = async () => {
    setIsGeneratingMusic(true)
    setMusicGenerationStatus('画像を分析中...')

    try {
      // すべての画像を分析（最大20枚まで）
      const imagesToAnalyze = images.slice(0, Math.min(20, images.length))
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

      // 各画像の躍動感スコアを取得
      const dynamismScores = imageAnalysisResults.map(a => a.dynamism || 5)
      
      // 各画像の表示時間を計算
      const displayDurations = dynamismScores.map(d => calculateDisplayDuration(d).base)
      
      // 合計表示時間を計算
      const totalDisplayTime = displayDurations.reduce((sum, d) => sum + d, 0)
      
      // 最低15秒は確保
      const targetDuration = Math.max(15, totalDisplayTime)
      
      console.log('Dynamism analysis:', { 
        dynamismScores, 
        displayDurations, 
        totalDisplayTime,
        targetDuration,
        imageCount: images.length
      })

      // 音楽生成用の情報を集約
      const musicGenres = imageAnalysisResults.map(a => a.musicGenre).filter(Boolean)
      const musicMoods = imageAnalysisResults.map(a => a.musicMood).filter(Boolean)
      const musicTempos = imageAnalysisResults.map(a => a.musicTempo).filter(Boolean)
      const atmospheres = imageAnalysisResults.map(a => a.atmosphere).filter(Boolean)
      const facialExpressions = imageAnalysisResults.map(a => a.facialExpression).filter(Boolean)
      const clothings = imageAnalysisResults.map(a => a.clothing).filter(Boolean)
      const seasons = imageAnalysisResults.map(a => a.season).filter(Boolean)
      const occasions = imageAnalysisResults.map(a => a.occasion).filter(Boolean)
      const emotionalImpacts = imageAnalysisResults.map(a => a.emotionalImpact).filter(Boolean)
      const colorMoods = imageAnalysisResults.map(a => a.colorMood).filter(Boolean)

      const dominantGenre = getMostFrequent(musicGenres) || 'pop'
      const dominantMood = getMostFrequent(musicMoods) || 'uplifting'
      const dominantTempo = getMostFrequent(musicTempos) || 'medium'
      const dominantSeason = getMostFrequent(seasons.filter(s => s !== '不明'))
      const dominantOccasion = getMostFrequent(occasions.filter(o => o !== '不明'))
      const dominantExpression = getMostFrequent(facialExpressions.filter(f => f !== 'なし'))
      const dominantClothing = getMostFrequent(clothings.filter(c => c !== 'なし'))
      const dominantColorMood = getMostFrequent(colorMoods)

      // 平均躍動感スコアを計算
      const avgDynamism = dynamismScores.length > 0 
        ? dynamismScores.reduce((a, b) => a + b, 0) / dynamismScores.length 
        : 5

      // 詳細なプロンプトを構築
      const promptParts = [
        `${dominantMood} ${dominantGenre} music`,
        `${dominantTempo} tempo`,
      ]
      
      if (atmospheres.length > 0) {
        promptParts.push(atmospheres.slice(0, 3).join(', '))
      }
      
      if (dominantSeason) {
        promptParts.push(`${dominantSeason}の雰囲気`)
      }
      
      if (dominantOccasion) {
        promptParts.push(`${dominantOccasion}シーン`)
      }
      
      if (dominantExpression) {
        promptParts.push(`${dominantExpression}な表情`)
      }
      
      if (dominantColorMood) {
        promptParts.push(`${dominantColorMood}色調`)
      }
      
      if (emotionalImpacts.length > 0) {
        promptParts.push(emotionalImpacts[0])
      }

      const prompt = promptParts.join(', ')
      console.log('Generated prompt:', prompt)

      setMusicGenerationStatus(`AIが曲を作成中... (目標: ${Math.round(targetDuration)}秒)`)

      const composeResponse = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration: targetDuration,
          genre: dominantGenre,
          mood: dominantMood,
          tempo: dominantTempo,
          withLyrics,
          // 追加情報
          season: dominantSeason,
          occasion: dominantOccasion,
          expression: dominantExpression,
          colorMood: dominantColorMood,
        }),
      })

      if (!composeResponse.ok) {
        const errorData = await composeResponse.text()
        console.error('Compose API error:', errorData)
        throw new Error(`Failed to start composition: ${errorData}`)
      }

      const composeData = await composeResponse.json()
      console.log('Compose response:', composeData)
      const taskId = composeData.taskId

      if (!taskId) {
        throw new Error('No taskId returned from compose API')
      }

      let trackUrl = null
      const maxAttempts = 120
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const elapsed = (i + 1) * 5
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
        
        setMusicGenerationStatus(`AIが曲を作成中... (${timeStr}経過)`)

        try {
          const statusResponse = await fetch(`/api/compose/status?taskId=${taskId}`)
          const statusData = await statusResponse.json()
          console.log('Status check:', statusData)
          
          if (statusResponse.ok) {
            if (statusData.status === 'completed' && statusData.trackUrl) {
              trackUrl = statusData.trackUrl
              break
            } else if (statusData.error) {
              throw new Error(`Composition failed: ${statusData.error}`)
            }
          }
        } catch (statusError) {
          console.warn('Status check error, retrying...', statusError)
        }
      }

      if (!trackUrl) {
        throw new Error('Music generation timed out (10分経過).')
      }

      setMusicGenerationStatus('曲をダウンロード中...')

      const audioResponse = await fetch(trackUrl)
      const audioBlob = await audioResponse.blob()
      const audioFile = new File([audioBlob], 'ai-generated-music.mp3', { type: 'audio/mpeg' })

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioFile.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const generatedAudio: UploadedAudio = {
        id: 'ai-generated',
        file: audioFile,
        name: withLyrics ? 'AI Generated Music (Vocal)' : 'AI Generated Music (Instrumental)',
        duration: audioBuffer.duration,
        url: URL.createObjectURL(audioBlob),
      }

      setAudio(generatedAudio)
      setStartTime(0)
      
      // ★重要: 曲全体ではなく、計算されたtargetDurationを使用
      // ただし、曲が短い場合は曲の長さに合わせる
      const actualEndTime = Math.min(targetDuration, audioBuffer.duration)
      setEndTime(actualEndTime)
      
      console.log('Duration settings:', {
        targetDuration,
        actualAudioDuration: audioBuffer.duration,
        actualEndTime,
      })

      setMusicGenerationStatus('動画を分析中...')

      // ★重要: 計算されたdurationとdynamism情報で分析を実行
      await runFullAnalysis(
        images,
        generatedAudio,
        0,
        actualEndTime,  // 曲全体ではなく、躍動感ベースの長さを使用
        aspectRatio,
        imageAnalysisResults  // dynamism情報を含む画像分析結果を渡す
      )

    } catch (error) {
      console.error('Auto generation failed:', error)
      setMusicGenerationStatus(`エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    } finally {
      setIsGeneratingMusic(false)
      setMusicGenerationStatus('')
    }
  }

  const getMostFrequent = (arr: string[]): string | null => {
    if (arr.length === 0) return null
    const counts: { [key: string]: number } = {}
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  const handleAudioChange = (newAudio: UploadedAudio | null) => {
    setAudio(newAudio)
    if (newAudio) {
      setStartTime(0)
      setEndTime(newAudio.duration)
    }
    reset()
    setShowExporter(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-5xl">🎬</span>
            AI Video Generator
          </h1>
          <p className="text-gray-600">
            複数の画像と音楽をアップロードするだけで、AIが最適なタイミングで動画を自動生成します
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!showExporter && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600"></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">📸 プレビュー</h2>
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                  {editingPlan && audio ? (
                    <VideoPreview
                      images={images}
                      editingPlan={editingPlan}
                      audio={audio!}
                      startTime={startTime}
                      endTime={endTime || audio!.duration}
                      aspectRatio={aspectRatio}
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

            <ModeSelector 
              mode={mode} 
              setMode={(newMode) => {
                setMode(newMode)
                reset()
                setShowExporter(false)
                if (newMode === 'auto') {
                  setAudio(null)
                }
              }}
              withLyrics={withLyrics}
              setWithLyrics={setWithLyrics}
            />

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

            {mode === 'auto' && audio && !isGeneratingMusic && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎵 AI生成された曲</h3>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-green-500">✓</span>
                  <span className="text-gray-700">{audio.name}</span>
                </div>
                <audio 
                  controls 
                  src={audio.url} 
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-2">
                  曲の長さ: {Math.floor(audio.duration / 60)}:{String(Math.floor(audio.duration % 60)).padStart(2, '0')}
                  {endTime < audio.duration && (
                    <span className="ml-2 text-primary-600">
                      (使用: {Math.floor(endTime / 60)}:{String(Math.floor(endTime % 60)).padStart(2, '0')})
                    </span>
                  )}
                </p>
              </div>
            )}

            <ImageUploader images={images} setImages={setImages} />

            <AspectRatioSelector selected={aspectRatio} onChange={setAspectRatio} />

            {isAnalyzing && (
              <AnalysisProgress
                isAnalyzing={isAnalyzing}
                progress={progress}
                currentStep={currentStep}
                error={error}
              />
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">エラーが発生しました</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}

            {editingPlan && !showExporter && (
              <TimelineView
                editingPlan={editingPlan}
                images={images}
                duration={endTime - startTime}
                onEditingPlanChange={setEditingPlan}
              />
            )}

            {showExporter && editingPlan && audio && (
              <VideoExporter
                images={images}
                audio={audio}
                editingPlan={editingPlan}
                aspectRatio={aspectRatio}
                startTime={startTime}
                endTime={endTime}
                fps={fps}
              />
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 ステータス</h3>
              <ul className="space-y-3 mb-6">
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
                      音源: AIが自動生成 {withLyrics ? '(ボーカル)' : '(インスト)'}
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
                    分析: {editingPlan ? '完了' : '未実施'}
                  </span>
                </li>
              </ul>

              {!showExporter && editingPlan && (
                <button
                  onClick={() => setShowExporter(true)}
                  className="w-full py-3 px-4 rounded-lg font-medium transition-all bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl mb-2"
                >
                  📥 動画をダウンロード
                </button>
              )}

              {!isAnalyzing && !editingPlan && (
                <button
                  onClick={handleAnalyze}
                  disabled={!canGenerate || isGeneratingMusic}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                    !canGenerate || isGeneratingMusic
                      ? 'bg-gray-200 text-gray-500'
                      : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl'
                  }`}
                >
                  🎬 分析を開始
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
    </div>
  )
}
