// アップロードされた画像
export interface UploadedImage {
  id: string
  file: File
  preview: string
  name: string
  analysis?: ImageAnalysis
}

// 画像分析結果
export interface ImageAnalysis {
  scene: string
  mood: string
  genre: string
  dominantColors: string[]
  visualIntensity: number
  suggestedDuration: 'short' | 'medium' | 'long'
  motionSuggestion: 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right'
  tags: string[]
}

// アップロードされた音源
export interface UploadedAudio {
  id: string
  file: File
  name: string
  duration: number
  url: string
  analysis?: AudioAnalysis
}

// 音源分析結果
export interface AudioAnalysis {
  bpm: number
  genre: string
  mood: string
  energy: number
  beats: Beat[]
  sections: Section[]
  highlights: Highlight[]
}

export interface Beat {
  time: number
  strength: 'strong' | 'weak'
}

export interface Section {
  start: number
  end: number
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro'
  energy: number
}

export interface Highlight {
  time: number
  type: 'drop' | 'climax' | 'breakdown' | 'transition'
  intensity: number
}

// アスペクト比
export type AspectRatio = '16:9' | '1:1' | '4:5' | '9:16'

export interface AspectRatioOption {
  value: AspectRatio
  label: string
  description: string
  width: number
  height: number
}

// タイムライン
export interface Timeline {
  duration: number
  resolution: string
  fps: number
  clips: Clip[]
}

export interface Clip {
  imageId: string
  startTime: number
  endTime: number
  transition: Transition
  effects: Effects
}

export interface Transition {
  type: 'fade' | 'cut' | 'slide' | 'zoom' | 'wipe' | 'blur'
  duration: number
  direction?: 'left' | 'right' | 'up' | 'down'
}

export interface Effects {
  motion: 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'
  motionIntensity: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

// ユーザープラン
export type Plan = 'free' | 'pro' | 'unlimited'

export interface User {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  plan: Plan
  createdAt: Date
}

export interface Usage {
  userId: string
  month: string
  videoCount: number
}

// プラン制限
export const PLAN_LIMITS: Record<Plan, {
  videosPerMonth: number
  maxDuration: number
  maxResolution: string
  watermark: boolean
}> = {
  free: {
    videosPerMonth: 3,
    maxDuration: 30,
    maxResolution: '720p',
    watermark: true,
  },
  pro: {
    videosPerMonth: 30,
    maxDuration: 180,
    maxResolution: '1080p',
    watermark: false,
  },
  unlimited: {
    videosPerMonth: Infinity,
    maxDuration: 600,
    maxResolution: '4K',
    watermark: false,
  },
}

// 編集計画
export interface EditingPlan {
  clips: EditingClip[]
  overallMood: string
  suggestedTitle: string
}

export interface EditingClip {
  imageIndex: number
  startTime: number
  endTime: number
  transition: {
    type: string
    duration: number
  }
  motion: {
    type: string
    intensity: number
  }
}
