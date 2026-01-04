'use client'

import { useState, useCallback } from 'react'
import { UploadedImage, UploadedAudio, ImageAnalysis, AudioAnalysis, EditingPlan } from '@/types'
import { loadAudioBuffer, analyzeAudio } from '@/lib/audioAnalyzer'

interface AnalysisState {
  isAnalyzing: boolean
  progress: number
  currentStep: string
  imageAnalyses: ImageAnalysis[] | null
  audioAnalysis: AudioAnalysis | null
  editingPlan: EditingPlan | null
  error: string | null
}

export function useVideoAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    currentStep: '',
    imageAnalyses: null,
    audioAnalysis: null,
    editingPlan: null,
    error: null,
  })

  const updateState = useCallback((updates: Partial<AnalysisState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // 画像分析（並列処理で高速化、Vercelの4.5MB制限を回避するため1枚ずつ送信）
  const analyzeImages = useCallback(async (images: UploadedImage[]): Promise<ImageAnalysis[]> => {
    const totalImages = images.length
    const CONCURRENT_LIMIT = 5 // 同時に5枚まで並列処理
    
    const analyses: (ImageAnalysis | null)[] = new Array(totalImages).fill(null)
    let completedCount = 0

    // 1枚の画像を分析する関数
    const analyzeOne = async (img: UploadedImage, index: number): Promise<void> => {
      const formData = new FormData()
      formData.append('image', img.file)
      formData.append('index', String(index))

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to analyze image ${index + 1}`)
      }

      const data = await response.json()
      analyses[index] = data.analysis
      
      completedCount++
      updateState({ 
        currentStep: `画像をAI分析中... (${completedCount}/${totalImages})`, 
        progress: 10 + Math.floor((completedCount / totalImages) * 20) 
      })
    }

    // 並列処理（CONCURRENT_LIMIT枚ずつ）
    for (let i = 0; i < totalImages; i += CONCURRENT_LIMIT) {
      const batch = images.slice(i, i + CONCURRENT_LIMIT)
      const promises = batch.map((img, batchIndex) => 
        analyzeOne(img, i + batchIndex)
      )
      await Promise.all(promises)
    }

    // nullチェック（全て完了しているはず）
    return analyses.filter((a): a is ImageAnalysis => a !== null)
  }, [updateState])

  // 音源分析（クライアントサイドで基本分析 + Claude APIで詳細分析）
  const analyzeAudioFile = useCallback(async (
    audio: UploadedAudio,
    startTime: number,
    endTime: number,
    imageCount: number
  ): Promise<AudioAnalysis> => {
    updateState({ currentStep: '音源を分析中...', progress: 35 })

    // AudioBufferを取得
    const audioBuffer = await loadAudioBuffer(audio.file)
    
    // クライアント側で基本的な音響分析を実行
    const analysisResult = await analyzeAudio(audioBuffer, startTime, endTime)
    const duration = endTime - startTime

    updateState({ currentStep: '曲調をAI分析中...', progress: 45 })

    // Claude APIで詳細分析
    const response = await fetch('/api/analyze/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioFeatures: {
          bpm: analysisResult.bpm,
          energy: analysisResult.energy,
          waveformData: analysisResult.waveformData,
          beats: analysisResult.beats,
          sections: analysisResult.sections,
          highlights: analysisResult.highlights,
          duration,
        },
        imageCount,
      }),
    })

    if (!response.ok) {
      console.error('Audio AI analysis failed, using basic analysis')
      // フォールバック
      return {
        bpm: analysisResult.bpm,
        genre: 'pop',
        mood: analysisResult.energy > 6 ? 'upbeat' : 'calm',
        energy: analysisResult.energy,
        beats: analysisResult.beats,
        sections: analysisResult.sections,
        highlights: analysisResult.highlights,
      }
    }

    const data = await response.json()
    const enhanced = data.analysis

    // Claude APIの結果をマージ
    const audioAnalysis: AudioAnalysis = {
      bpm: enhanced.bpm || analysisResult.bpm,
      genre: enhanced.genre || 'pop',
      mood: enhanced.mood || (analysisResult.energy > 6 ? 'upbeat' : 'calm'),
      energy: enhanced.energy || analysisResult.energy,
      beats: enhanced.beats || analysisResult.beats,
      sections: enhanced.sections || analysisResult.sections,
      highlights: enhanced.rhythmEvents || analysisResult.highlights,
      // 追加情報
      switchPoints: enhanced.switchPoints,
      overallFeel: enhanced.overallFeel,
    }

    return audioAnalysis
  }, [updateState])

  // 編集計画生成
  const generateEditingPlan = useCallback(async (
    imageAnalyses: ImageAnalysis[],
    audioAnalysis: AudioAnalysis,
    duration: number,
    aspectRatio: string
  ): Promise<EditingPlan> => {
    updateState({ currentStep: '編集計画を生成中...', progress: 70 })

    const response = await fetch('/api/analyze/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageAnalyses,
        audioAnalysis,
        duration,
        aspectRatio,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate editing plan')
    }

    const data = await response.json()
    return data.editingPlan
  }, [updateState])

  // 全分析を実行
  const runFullAnalysis = useCallback(async (
    images: UploadedImage[],
    audio: UploadedAudio,
    startTime: number,
    endTime: number,
    aspectRatio: string
  ) => {
    updateState({
      isAnalyzing: true,
      progress: 0,
      currentStep: '分析を開始...',
      error: null,
    })

    try {
      // 1. 画像分析（簡易、高速）
      const imageAnalyses = await analyzeImages(images)
      updateState({ imageAnalyses, progress: 30 })

      // 2. 音源分析（Claude APIで詳細分析）
      const audioAnalysis = await analyzeAudioFile(audio, startTime, endTime, images.length)
      updateState({ audioAnalysis, progress: 60 })

      // 3. 編集計画生成
      const duration = endTime - startTime
      const editingPlan = await generateEditingPlan(
        imageAnalyses,
        audioAnalysis,
        duration,
        aspectRatio
      )
      
      updateState({
        editingPlan,
        progress: 100,
        currentStep: '分析完了！',
        isAnalyzing: false,
      })

      return { imageAnalyses, audioAnalysis, editingPlan }
    } catch (error) {
      updateState({
        error: error instanceof Error ? error.message : 'Unknown error',
        isAnalyzing: false,
        currentStep: 'エラーが発生しました',
      })
      throw error
    }
  }, [analyzeImages, analyzeAudioFile, generateEditingPlan, updateState])

  // 状態をリセット
  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      progress: 0,
      currentStep: '',
      imageAnalyses: null,
      audioAnalysis: null,
      editingPlan: null,
      error: null,
    })
  }, [])

  // 編集計画を更新
  const setEditingPlan = useCallback((plan: EditingPlan) => {
    setState(prev => ({ ...prev, editingPlan: plan }))
  }, [])

  return {
    ...state,
    runFullAnalysis,
    reset,
    setEditingPlan,
  }
}