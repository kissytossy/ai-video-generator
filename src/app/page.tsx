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

  const handleAutoGeneration = async () => {
    setIsGeneratingMusic(true)
    setMusicGenerationStatus('画像を分析中...')

    try {
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

      const musicGenres = imageAnalysisResults.map(a => a.musicGenre).filter(Boolean)
      const musicMoods = imageAnalysisResults.map(a => a.musicMood).filter(Boolean)
      const musicTempos = imageAnalysisResults.map(a => a.musicTempo).filter(Boolean)
      const atmospheres = imageAnalysisResults.map(a => a.atmosphere).filter(Boolean)

      const dominantGenre = getMostFrequent(musicGenres) || 'pop'
      const dominantMood = getMostFrequent(musicMoods) || 'uplifting'
      const dominantTempo = getMostFrequent(musicTempos) || 'medium'

      const tempoMultiplier = dominantTempo === 'fast' ? 1.0 : dominantTempo === 'slow' ? 3.0 : 2.0
      const duration = Math.max(15, Math.min(120, images.length * tempoMultiplier))

      const prompt = `${dominantMood} ${dominantGenre} music, ${dominantTempo} tempo, ${atmospheres.join(', ')}`

      setMusicGenerationStatus('AIが曲を作成中...')

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
        name: 'AI Generated Music',
        duration: audioBuffer.duration,
        url: URL.createObjectURL(audioBlob),
      }

      setAudio(generatedAudio)
      setStartTime(0)
      setEndTime(audioBuffer.duration)

      setMusicGenerationStatus('動画を分析中...')

      await runFullAnalysis(
        images,
        generatedAudio,
        0,
        audioBuffer.duration,
        aspectRatio
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
                  {editingPlan && audioAnalysis ? (
                    <VideoPreview
                      images={images}
                      editingPlan={editingPlan}
                      audio={audio!}
                      startTime={startTime}
                      endTime={endTime || audio!.duration}
                      fps={fps}
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

            <ModeSelector mode={mode} setMode={(newMode) => {
              setMode(newMode)
              reset()
              setShowExporter(false)
              if (newMode === 'auto') {
                setAudio(null)
              }
            }} />

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
                  長さ: {Math.floor(audio.duration / 60)}:{String(Math.floor(audio.duration % 60)).padStart(2, '0')}
                </p>
              </div>
            )}

            <ImageUploader images={images} setImages={setImages} />

            <AspectRatioSelector aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} />

            {isAnalyzing && (
              <AnalysisProgress 
                progress={progress}
                currentStep={currentStep}
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
                audioAnalysis={audioAnalysis}
                images={images}
                onUpdate={setEditingPlan}
              />
            )}

            {showExporter && editingPlan && audioAnalysis && audio && (
              <VideoExporter
                images={images}
                editingPlan={editingPlan}
                audioAnalysis={audioAnalysis}
                audio={audio}
                fps={fps}
                aspectRatio={aspectRatio}
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
                    分析: {editingPlan ? '完了' : '未実施'}
                  </span>
                </li>
              </ul>

              {!showExporter && editingPlan && (
                <button
                  onClick={() => setShowExporter(true)}
                  className="w-full py-3 px-4 rounded-lg font-medium transition-all bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl mb-2"
                >
                  ✨ 動画を生成する
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
