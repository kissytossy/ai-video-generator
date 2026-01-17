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

  // 謇句虚繝｢繝ｼ繝・ 逕ｻ蜒・髻ｳ貅舌′蠢・ｦ・  // 閾ｪ蜍輔Δ繝ｼ繝・ 逕ｻ蜒上・縺ｿ縺ｧOK
  const canGenerate = mode === 'manual' 
    ? images.length >= 2 && audio !== null
    : images.length >= 2

  const handleAnalyze = async () => {
    if (!canGenerate) return
    
    try {
      if (mode === 'manual' && audio) {
        // 謇句虚繝｢繝ｼ繝・ 蠕捺擂縺ｮ蜃ｦ逅・        await runFullAnalysis(
          images,
          audio,
          startTime,
          endTime || audio.duration,
          aspectRatio
        )
      } else if (mode === 'auto') {
        // AI閾ｪ蜍慕函謌舌Δ繝ｼ繝・        await handleAutoGeneration()
      }
    } catch (e) {
      console.error('Analysis failed:', e)
    }
  }

  // AI閾ｪ蜍慕函謌舌Δ繝ｼ繝峨・蜃ｦ逅・  const handleAutoGeneration = async () => {
    setIsGeneratingMusic(true)
    setMusicGenerationStatus('逕ｻ蜒上ｒ蛻・梵荳ｭ...')

    try {
      // 1. 逕ｻ蜒上ｒAI蛻・梵・域怙蛻昴・謨ｰ譫壹ｒ莉｣陦ｨ縺ｨ縺励※蛻・梵・・      const imagesToAnalyze = images.slice(0, Math.min(5, images.length))
      const imageAnalysisResults = []

      for (let i = 0; i < imagesToAnalyze.length; i++) {
        setMusicGenerationStatus(`逕ｻ蜒上ｒ蛻・梵荳ｭ... (${i + 1}/${imagesToAnalyze.length})`)
        
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

      // 2. 逕ｻ蜒丞・譫千ｵ先棡縺九ｉ髻ｳ讌ｽ繝励Ο繝ｳ繝励ヨ繧堤函謌・      const musicGenres = imageAnalysisResults.map(a => a.musicGenre).filter(Boolean)
      const musicMoods = imageAnalysisResults.map(a => a.musicMood).filter(Boolean)
      const musicTempos = imageAnalysisResults.map(a => a.musicTempo).filter(Boolean)
      const atmospheres = imageAnalysisResults.map(a => a.atmosphere).filter(Boolean)

      // 譛繧ょ､壹＞繧ｸ繝｣繝ｳ繝ｫ繝ｻ繝繝ｼ繝峨・繝・Φ繝昴ｒ驕ｸ謚・      const dominantGenre = getMostFrequent(musicGenres) || 'pop'
      const dominantMood = getMostFrequent(musicMoods) || 'uplifting'
      const dominantTempo = getMostFrequent(musicTempos) || 'medium'

      // 3. 譖ｲ縺ｮ髟ｷ縺輔ｒ險育ｮ・      const tempoMultiplier = dominantTempo === 'fast' ? 1.0 : dominantTempo === 'slow' ? 3.0 : 2.0
      const duration = Math.max(15, Math.min(120, images.length * tempoMultiplier))

      // 4. 髻ｳ讌ｽ繝励Ο繝ｳ繝励ヨ繧剃ｽ懈・
      const prompt = `${dominantMood} ${dominantGenre} music, ${dominantTempo} tempo, ${atmospheres.join(', ')}`

      setMusicGenerationStatus('AI縺梧峇繧剃ｽ懈・荳ｭ...')

      // 5. sunoapi.orgで音楽生成リクエスト
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

      // 6. 菴懈峇螳御ｺ・ｒ繝昴・繝ｪ繝ｳ繧ｰ・域怙螟ｧ10蛻・ｾ・ｩ滂ｼ・      let trackUrl = null
      const maxAttempts = 120  // 120蝗・ﾃ・5遘・= 10蛻・      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const elapsed = (i + 1) * 5
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        const timeStr = minutes > 0 ? `${minutes}蛻・{seconds}遘蛋 : `${seconds}遘蛋
        
        setMusicGenerationStatus(`AI縺梧峇繧剃ｽ懈・荳ｭ... (${timeStr}邨碁℃)`)

        try {
          const statusResponse = await fetch(`/api/compose/status?taskId=${taskId}`)
          const statusData = await statusResponse.json()
          console.log('Status check:', statusData)
          
          if (statusResponse.ok) {
            // 繧ｹ繝・・繧ｿ繧ｹ縺ｫ蠢懊§縺溯｡ｨ遉ｺ
            if (statusData.status === 'composing') {
              setMusicGenerationStatus(`AI縺梧峇繧剃ｽ懈・荳ｭ... 繧ｭ繝･繝ｼ縺ｧ蠕・ｩ滉ｸｭ (${timeStr}邨碁℃)`)
            } else if (statusData.status === 'running') {
              setMusicGenerationStatus(`AI縺梧峇繧剃ｽ懈・荳ｭ... 逕滓・荳ｭ (${timeStr}邨碁℃)`)
            } else if (statusData.status === 'completed' && statusData.trackUrl) {
              trackUrl = statusData.trackUrl
              break
            } else if (statusData.error) {
              throw new Error(`Composition failed: ${statusData.error}`)
            }
          } else {
            console.warn('Status check failed:', statusData)
          }
        } catch (statusError) {
          console.warn('Status check error, retrying...', statusError)
          // 繧ｨ繝ｩ繝ｼ縺ｧ繧らｶ咏ｶ壹＠縺ｦ繝ｪ繝医Λ繧､
        }
      }

      if (!trackUrl) {
        throw new Error('Music generation timed out (10蛻・ｵ碁℃). Please try again.')
      }

      setMusicGenerationStatus('譖ｲ繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝我ｸｭ...')

      // 7. 逕滓・縺輔ｌ縺滓峇繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝峨＠縺ｦaudio state縺ｫ險ｭ螳・      const audioResponse = await fetch(trackUrl)
      const audioBlob = await audioResponse.blob()
      const audioFile = new File([audioBlob], 'ai-generated-music.mp3', { type: 'audio/mpeg' })

      // AudioContext縺ｧ髟ｷ縺輔ｒ蜿門ｾ・      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
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

      setMusicGenerationStatus('蜍慕判繧貞・譫蝉ｸｭ...')

      // 8. 騾壼ｸｸ縺ｮ蛻・梵繝輔Ο繝ｼ繧貞ｮ溯｡・      await runFullAnalysis(
        images,
        generatedAudio,
        0,
        audioBuffer.duration,
        aspectRatio
      )

    } catch (error) {
      console.error('Auto generation failed:', error)
      setMusicGenerationStatus(`繧ｨ繝ｩ繝ｼ: ${error instanceof Error ? error.message : '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`)
      // 繧ｨ繝ｩ繝ｼ繝｡繝・そ繝ｼ繧ｸ繧・遘帝俣陦ｨ遉ｺ
      await new Promise(resolve => setTimeout(resolve, 3000))
    } finally {
      setIsGeneratingMusic(false)
      setMusicGenerationStatus('')
    }
  }

  // 驟榊・縺九ｉ譛鬆ｻ蛟､繧貞叙蠕・  const getMostFrequent = (arr: string[]): string | null => {
    if (arr.length === 0) return null
    const counts: { [key: string]: number } = {}
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  // AudioUploader縺九ｉ遽・峇驕ｸ謚槭ｒ蜿励￠蜿悶ｋ縺溘ａ縺ｮ繝ｩ繝・ヱ繝ｼ
  const handleAudioChange = (newAudio: UploadedAudio | null) => {
    setAudio(newAudio)
    if (newAudio) {
      setStartTime(0)
      setEndTime(newAudio.duration)
    }
    // 髻ｳ貅舌′螟峨ｏ縺｣縺溘ｉ蛻・梵邨先棡繧偵Μ繧ｻ繝・ヨ
    reset()
    setShowExporter(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 蛻・梵繝励Ο繧ｰ繝ｬ繧ｹ */}
      <AnalysisProgress
        isAnalyzing={isAnalyzing}
        progress={progress}
        currentStep={currentStep}
        error={error}
      />

      {/* 繝偵・繝ｭ繝ｼ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          逕ｻ蜒上→髻ｳ讌ｽ縺九ｉ<span className="text-primary-600">閾ｪ蜍輔〒蜍慕判</span>繧剃ｽ懈・
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          隍・焚縺ｮ逕ｻ蜒上→髻ｳ貅舌ｒ繧｢繝・・繝ｭ繝ｼ繝峨☆繧九□縺代〒縲、I縺梧怙驕ｩ縺ｪ繧ｿ繧､繝溘Φ繧ｰ縺ｨ
          繝医Λ繝ｳ繧ｸ繧ｷ繝ｧ繝ｳ縺ｧ蜍慕判繧堤函謌舌＠縺ｾ縺吶・        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 蟾ｦ繧ｫ繝ｩ繝: 繝励Ξ繝薙Η繝ｼ繧ｨ繝ｪ繧｢ */}
        <div className="lg:col-span-2 space-y-6">
          {/* 繝励Ξ繝薙Η繝ｼ - 蛻・梵螳御ｺ・ｾ後・VideoPreview繧定｡ｨ遉ｺ */}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">繝励Ξ繝薙Η繝ｼ</h3>
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
                    <span className="text-4xl mb-2 block">磁</span>
                    <p>逕ｻ蜒上ｒ繧｢繝・・繝ｭ繝ｼ繝峨☆繧九→繝励Ξ繝薙Η繝ｼ縺瑚｡ｨ遉ｺ縺輔ｌ縺ｾ縺・/p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 繝｢繝ｼ繝蛾∈謚・*/}
          <ModeSelector mode={mode} setMode={(newMode) => {
            setMode(newMode)
            reset()
            setShowExporter(false)
            if (newMode === 'auto') {
              setAudio(null)
            }
          }} />

          {/* 髻ｳ貅舌い繝・・繝ｭ繝ｼ繝会ｼ域焔蜍輔Δ繝ｼ繝峨・縺ｿ陦ｨ遉ｺ・・*/}
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

          {/* AI逕滓・荳ｭ縺ｮ陦ｨ遉ｺ */}
          {isGeneratingMusic && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">七 AI菴懈峇荳ｭ</h3>
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-700">{musicGenerationStatus}</span>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                窶ｻ 菴懈峇縺ｫ縺ｯ30遘偵・蛻・ｨ句ｺｦ縺九°繧翫∪縺・              </p>
            </div>
          )}

          {/* 閾ｪ蜍慕函謌舌Δ繝ｼ繝峨〒逕滓・縺輔ｌ縺滓峇縺ｮ陦ｨ遉ｺ */}
          {mode === 'auto' && audio && !isGeneratingMusic && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">七 AI逕滓・縺輔ｌ縺滓峇</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-green-500">笨・/span>
                <span className="text-gray-700">{audio.name}</span>
              </div>
              <audio 
                controls 
                src={audio.url} 
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-2">
                髟ｷ縺・ {Math.floor(audio.duration / 60)}:{String(Math.floor(audio.duration % 60)).padStart(2, '0')}
              </p>
            </div>
          )}

          {/* 逕ｻ蜒上い繝・・繝ｭ繝ｼ繝・*/}
          <ImageUploader 
            images={images} 
            setImages={setImages}
          />

          {/* 繧ｿ繧､繝繝ｩ繧､繝ｳ・亥・譫仙ｮ御ｺ・ｾ後↓陦ｨ遉ｺ・・*/}
          {editingPlan && (
            <TimelineView 
              editingPlan={editingPlan}
              images={images}
              duration={(endTime || audio?.duration || 0) - startTime}
              onEditingPlanChange={setEditingPlan}
            />
          )}

          {/* 蜍慕判繧ｨ繧ｯ繧ｹ繝昴・繧ｿ繝ｼ・亥・譫仙ｮ御ｺ・ｾ後↓陦ｨ遉ｺ・・*/}
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

        {/* 蜿ｳ繧ｫ繝ｩ繝: 繧ｳ繝ｳ繝医Ο繝ｼ繝ｫ繝代ロ繝ｫ */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">險ｭ螳・/h3>
            
            {/* 繧｢繧ｹ繝壹け繝域ｯ秘∈謚・*/}
            <AspectRatioSelector 
              selected={aspectRatio} 
              onChange={(ratio) => {
                setAspectRatio(ratio)
                reset()
                setShowExporter(false)
              }} 
            />

            {/* FPS驕ｸ謚・*/}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                汐 繝輔Ξ繝ｼ繝繝ｬ繝ｼ繝・              </label>
              <select 
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={30} className="text-gray-900 bg-white">30 FPS・域耳螂ｨ・・/option>
                <option value={24} className="text-gray-900 bg-white">24 FPS・域丐逕ｻ鬚ｨ・・/option>
                <option value={60} className="text-gray-900 bg-white">60 FPS・域ｻ代ｉ縺具ｼ・/option>
              </select>
            </div>

            {/* 繧ｹ繝・・繧ｿ繧ｹ陦ｨ遉ｺ */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">貅門ｙ迥ｶ豕・/h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {images.length >= 2 ? (
                    <span className="text-green-500">笨・/span>
                  ) : (
                    <span className="text-gray-300">笳・/span>
                  )}
                  <span className={images.length >= 2 ? 'text-gray-900' : 'text-gray-500'}>
                    逕ｻ蜒・ {images.length}譫夲ｼ・譫壻ｻ･荳雁ｿ・ｦ・ｼ・                  </span>
                </li>
                {mode === 'manual' && (
                  <li className="flex items-center gap-2">
                    {audio ? (
                      <span className="text-green-500">笨・/span>
                    ) : (
                      <span className="text-gray-300">笳・/span>
                    )}
                    <span className={audio ? 'text-gray-900' : 'text-gray-500'}>
                      髻ｳ貅・ {audio ? audio.name : '譛ｪ驕ｸ謚・}
                    </span>
                  </li>
                )}
                {mode === 'auto' && (
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500">､・/span>
                    <span className="text-gray-700">
                      髻ｳ貅・ AI縺瑚・蜍慕函謌・                    </span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  {editingPlan ? (
                    <span className="text-green-500">笨・/span>
                  ) : (
                    <span className="text-gray-300">笳・/span>
                  )}
                  <span className={editingPlan ? 'text-gray-900' : 'text-gray-500'}>
                    AI蛻・梵: {editingPlan ? '螳御ｺ・ : '譛ｪ螳溯｡・}
                  </span>
                </li>
              </ul>
            </div>

            {/* 蛻・梵邨先棡繧ｵ繝槭Μ繝ｼ */}
            {imageAnalyses && audioAnalysis && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">笨ｨ 蛻・梵邨先棡</h4>
                <ul className="space-y-1 text-sm text-green-700">
                  <li>七 BPM: {audioAnalysis.bpm}</li>
                  <li>鹿 繝繝ｼ繝・ {audioAnalysis.mood}</li>
                  <li>笞｡ 繧ｨ繝阪Ν繧ｮ繝ｼ: {audioAnalysis.energy}/10</li>
                  <li>萄 逕ｻ蜒・ {imageAnalyses.length}譫壼・譫先ｸ医∩</li>
                  {mode === 'auto' && <li>､・譖ｲ: AI閾ｪ蜍慕函謌・/li>}
                </ul>
              </div>
            )}

            {/* 蛻・梵/逕滓・繝懊ち繝ｳ */}
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
                    {isGeneratingMusic ? 'AI菴懈峇荳ｭ...' : '蛻・梵荳ｭ...'}
                  </span>
                ) : (
                  mode === 'auto' ? '､・AI縺ｧ譖ｲ繧剃ｽ懈・ & 蛻・梵' : '､・AI縺ｧ蛻・梵縺吶ｋ'
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
                {showExporter ? '燥 荳九↓繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺励※蜍慕判繧堤函謌・ : '笨ｨ 蜍慕判繧堤函謌舌☆繧・}
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
                売 蜀榊・譫舌☆繧・              </button>
            )}

            {/* 繝励Λ繝ｳ陦ｨ遉ｺ・・hase 7縺ｧ螳溯｣・ｼ・*/}
            <div className="mt-6 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-800">
                <span className="font-semibold">Free 繝励Λ繝ｳ</span>: 谿九ｊ 3/3 譛ｬ
              </p>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Pro縺ｫ繧｢繝・・繧ｰ繝ｬ繝ｼ繝・竊・              </a>
            </div>

            {/* 闡嶺ｽ懈ｨｩ繝ｻ蜈崎ｲｬ莠矩・*/}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">笞・・縺泌茜逕ｨ縺ｫ縺ゅ◆縺｣縺ｦ</h4>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li>窶｢ <strong>PC蟆ら畑</strong>・・hrome / Edge謗ｨ螂ｨ・峨〒縺吶・/li>
                <li>窶｢ 繧ｹ繝槭・繝ｻ繧ｿ繝悶Ξ繝・ヨ縺ｧ縺ｯ蜍穂ｽ懊＠縺ｾ縺帙ｓ縲・/li>
                <li>窶｢ 髻ｳ貅舌・闡嶺ｽ懈ｨｩ縺ｫ蜊∝・縺疲ｳｨ諢上・荳翫∬・蟾ｱ雋ｬ莉ｻ縺ｧ縺比ｽｿ逕ｨ縺上□縺輔＞縲り送菴懈ｨｩ萓ｵ螳ｳ縺ｫ髢｢縺励※蠖薙し繝ｼ繝薙せ縺ｯ荳蛻・・雋ｬ莉ｻ繧定ｲ縺・∪縺帙ｓ縲・/li>
                <li>窶｢ 蜍慕判繧堤函謌舌＠縺滓凾轤ｹ縺ｧ縲∽ｸ願ｨ倥・蜈崎ｲｬ莠矩・↓蜷梧э縺励◆繧ゅ・縺ｨ縺ｿ縺ｪ縺励∪縺吶・/li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
