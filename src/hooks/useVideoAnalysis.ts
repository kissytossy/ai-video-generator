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

  // 画像分析
  const analyzeImages = useCallback(async (images: UploadedImage[]): Promise<ImageAnalysis[]> => {
    updateState({ currentStep: '画像を分析中...', progress: 10 })

    const formData = new FormData()
    images.forEach(img => {
      formData.append('images', img.file)
    })

    const response = await fetch('/api/analyze/images', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to analyze images')
    }

    const data = await response.json()
    return data.analyses
  }, [updateState])

  // 音源分析（クライアントサイドで実行）
  const analyzeAudioFile = useCallback(async (
    audio: UploadedAudio,
    startTime: number,
    endTime: number
  ): Promise<AudioAnalysis> => {
    updateState({ currentStep: '音源を分析中...', progress: 40 })

    // AudioBufferを取得
    const audioBuffer = await loadAudioBuffer(audio.file)
    
    // 音響分析を実行
    const analysisResult = await analyzeAudio(audioBuffer, startTime, endTime)

    // ジャンルとムードはAPIで推定（オプション）
    // 今回は簡易的にデフォルト値を使用
    const audioAnalysis: AudioAnalysis = {
      bpm: analysisResult.bpm,
      genre: 'pop', // TODO: Claude APIで推定
      mood: analysisResult.energy > 6 ? 'upbeat' : 'calm',
      energy: analysisResult.energy,
      beats: analysisResult.beats,
      sections: analysisResult.sections,
      highlights: analysisResult.highlights,
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
      // 1. 画像分析
      const imageAnalyses = await analyzeImages(images)
      updateState({ imageAnalyses, progress: 30 })

      // 2. 音源分析
      const audioAnalysis = await analyzeAudioFile(audio, startTime, endTime)
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

  return {
    ...state,
    runFullAnalysis,
    reset,
  }
}
