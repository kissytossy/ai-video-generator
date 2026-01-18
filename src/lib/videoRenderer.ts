'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { UploadedImage, EditingPlan, AspectRatio } from '@/types'

// アスペクト比から解像度を取得
export const RESOLUTIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}

// イージング関数
const easings = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
}

// 画像をCanvasに描画（モーションエフェクト付き）
export function drawImageWithMotion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  progress: number, // 0-1
  motion: { type: string; intensity: number },
  easing: keyof typeof easings = 'ease-out'
) {
  // progressを0-1の範囲に制限
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const easedProgress = easings[easing](clampedProgress)
  // intensityを0.05-0.15の範囲に制限（自然なズーム/パン）
  const intensity = Math.max(0.05, Math.min(0.15, motion.intensity || 0.1))

  // 画像のアスペクト比を維持しながらカバー
  const imgAspect = img.width / img.height
  const canvasAspect = canvasWidth / canvasHeight

  let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number

  if (imgAspect > canvasAspect) {
    // 画像が横長
    drawHeight = canvasHeight
    drawWidth = drawHeight * imgAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = 0
  } else {
    // 画像が縦長
    drawWidth = canvasWidth
    drawHeight = drawWidth / imgAspect
    offsetX = 0
    offsetY = (canvasHeight - drawHeight) / 2
  }

  ctx.save()

  // モーションエフェクトを適用
  switch (motion.type) {
    case 'zoom-in': {
      const scale = 1 + intensity * easedProgress
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      break
    }
    case 'zoom-out': {
      const scale = 1 + intensity * (1 - easedProgress)
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      break
    }
    case 'pan-left': {
      const scale = 1.3
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      const panX = canvasWidth * 0.1 * easedProgress
      ctx.translate(-panX, 0)
      break
    }
    case 'pan-right': {
      const scale = 1.3
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      const panX = canvasWidth * 0.1 * easedProgress
      ctx.translate(panX, 0)
      break
    }
    case 'pan-up': {
      const scale = 1.3
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      const panY = canvasHeight * 0.1 * easedProgress
      ctx.translate(0, -panY)
      break
    }
    case 'pan-down': {
      const scale = 1.3
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      const panY = canvasHeight * 0.1 * easedProgress
      ctx.translate(0, panY)
      break
    }
    // static - 何もしない
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
  ctx.restore()
}

// トランジション描画
export function drawTransition(
  ctx: CanvasRenderingContext2D,
  imgFrom: HTMLImageElement | null,
  imgTo: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  progress: number, // 0-1
  transitionType: string,
  direction?: string
) {
  ctx.save()

  // progressを0-1の範囲にクランプ
  const p = Math.max(0, Math.min(1, progress))

  switch (transitionType) {
    case 'fade':
      if (imgFrom) {
        ctx.globalAlpha = 1
        drawImageCover(ctx, imgFrom, canvasWidth, canvasHeight)
        ctx.globalAlpha = p
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      } else {
        ctx.globalAlpha = p
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'dissolve':
      if (imgFrom) {
        ctx.globalAlpha = 1 - p
        drawImageCover(ctx, imgFrom, canvasWidth, canvasHeight)
        ctx.globalAlpha = p
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      } else {
        ctx.globalAlpha = p
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'slide':
    case 'slide-left':
      if (imgFrom) {
        ctx.save()
        ctx.translate(-canvasWidth * p, 0)
        drawImageCoverScaled(ctx, imgFrom, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
        
        ctx.save()
        ctx.translate(canvasWidth * (1 - p), 0)
        drawImageCoverScaled(ctx, imgTo, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
      } else {
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'slide-right':
      if (imgFrom) {
        ctx.save()
        ctx.translate(canvasWidth * p, 0)
        drawImageCoverScaled(ctx, imgFrom, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
        
        ctx.save()
        ctx.translate(-canvasWidth * (1 - p), 0)
        drawImageCoverScaled(ctx, imgTo, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
      } else {
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'slide-up':
      if (imgFrom) {
        ctx.save()
        ctx.translate(0, -canvasHeight * p)
        drawImageCoverScaled(ctx, imgFrom, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
        
        ctx.save()
        ctx.translate(0, canvasHeight * (1 - p))
        drawImageCoverScaled(ctx, imgTo, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
      } else {
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'slide-down':
      if (imgFrom) {
        ctx.save()
        ctx.translate(0, canvasHeight * p)
        drawImageCoverScaled(ctx, imgFrom, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
        
        ctx.save()
        ctx.translate(0, -canvasHeight * (1 - p))
        drawImageCoverScaled(ctx, imgTo, canvasWidth, canvasHeight, 1.1)
        ctx.restore()
      } else {
        drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      }
      break

    case 'wipe':
      if (imgFrom) {
        drawImageCover(ctx, imgFrom, canvasWidth, canvasHeight)
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, canvasWidth * p, canvasHeight)
      ctx.clip()
      drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      ctx.restore()
      break

    case 'zoom':
      if (imgFrom) {
        ctx.globalAlpha = 1 - p
        const scaleFrom = 1 + p * 0.3
        ctx.save()
        ctx.translate(canvasWidth / 2, canvasHeight / 2)
        ctx.scale(scaleFrom, scaleFrom)
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2)
        drawImageCover(ctx, imgFrom, canvasWidth, canvasHeight)
        ctx.restore()
      }
      ctx.globalAlpha = p
      const scaleTo = 1.3 - p * 0.3
      ctx.save()
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.scale(scaleTo, scaleTo)
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2)
      drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      ctx.restore()
      break

    case 'none':
    case 'cut':
    default:
      drawImageCover(ctx, imgTo, canvasWidth, canvasHeight)
      break
  }

  ctx.restore()
}

// 画像をキャンバスにカバーフィットで描画（シンプル版）
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
) {
  const imgAspect = img.width / img.height
  const canvasAspect = canvasWidth / canvasHeight
  
  let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number
  
  if (imgAspect > canvasAspect) {
    drawHeight = canvasHeight
    drawWidth = canvasHeight * imgAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = 0
  } else {
    drawWidth = canvasWidth
    drawHeight = canvasWidth / imgAspect
    offsetX = 0
    offsetY = (canvasHeight - drawHeight) / 2
  }
  
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
}

// 画像をキャンバスにカバーフィットで描画（拡大版 - スライド用）
function drawImageCoverScaled(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  scale: number
) {
  const imgAspect = img.width / img.height
  const canvasAspect = canvasWidth / canvasHeight
  
  let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number
  
  if (imgAspect > canvasAspect) {
    drawHeight = canvasHeight * scale
    drawWidth = drawHeight * imgAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = (canvasHeight - drawHeight) / 2
  } else {
    drawWidth = canvasWidth * scale
    drawHeight = drawWidth / imgAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = (canvasHeight - drawHeight) / 2
  }
  
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
}

// 画像をロード
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// 画像を安全にロード（常にFileからDataURLを作成して確実に読み込む）
async function loadImageSafe(uploadedImage: UploadedImage): Promise<HTMLImageElement> {
  // 常にFileからDataURLを作成（Blob URLは時間経過で無効になる可能性があるため）
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(uploadedImage.file)
    })
    const img = await loadImage(dataUrl)
    console.log(`Image loaded successfully: ${uploadedImage.name}`)
    return img
  } catch (e) {
    console.error('Failed to load image from file:', e)
    // フォールバック：preview（Blob URL）を試す
    try {
      console.log('Trying preview URL as fallback...')
      const img = await loadImage(uploadedImage.preview)
      return img
    } catch (e2) {
      console.error('Fallback also failed:', e2)
      throw new Error(`画像の読み込みに失敗しました: ${uploadedImage.name}`)
    }
  }
}

// プレビュー用フレームレンダラー
export class PreviewRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private images: HTMLImageElement[] = []
  private editingPlan: EditingPlan | null = null
  private aspectRatio: AspectRatio = '16:9'

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')
    this.ctx = ctx
  }

  async setImages(uploadedImages: UploadedImage[]) {
    this.images = await Promise.all(
      uploadedImages.map(img => loadImageSafe(img))
    )
  }

  setEditingPlan(plan: EditingPlan) {
    this.editingPlan = plan
  }

  setAspectRatio(ratio: AspectRatio) {
    this.aspectRatio = ratio
    const { width, height } = RESOLUTIONS[ratio]
    // プレビュー用にスケールダウン
    const scale = Math.min(800 / width, 600 / height)
    this.canvas.width = width * scale
    this.canvas.height = height * scale
  }

  // 特定の時間のフレームを描画
  renderFrame(currentTime: number) {
    if (!this.editingPlan || this.images.length === 0) return

    const { width, height } = this.canvas
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, width, height)

    const clips = this.editingPlan.clips

    // 現在のクリップを見つける
    let currentClipIndex = clips.findIndex(
      clip => currentTime >= clip.startTime && currentTime < clip.endTime
    )

    if (currentClipIndex === -1) {
      // 最後のクリップの後
      currentClipIndex = clips.length - 1
    }

    const currentClip = clips[currentClipIndex]
    if (!currentClip) return

    const currentImage = this.images[currentClip.imageIndex]
    if (!currentImage) return

    const clipDuration = currentClip.endTime - currentClip.startTime
    const clipProgress = (currentTime - currentClip.startTime) / clipDuration
    const transitionDuration = currentClip.transition.duration

    // トランジション中かどうか
    const transitionProgress = currentClip.transition.duration > 0 
      ? Math.min(1, (currentTime - currentClip.startTime) / transitionDuration)
      : 1

    if (transitionProgress < 1 && currentClipIndex > 0) {
      // トランジション中
      const prevClip = clips[currentClipIndex - 1]
      const prevImage = this.images[prevClip?.imageIndex]
      
      drawTransition(
        this.ctx,
        prevImage || null,
        currentImage,
        width,
        height,
        transitionProgress,
        currentClip.transition.type
      )
    } else {
      // 通常描画（モーションエフェクト付き）
      drawImageWithMotion(
        this.ctx,
        currentImage,
        width,
        height,
        clipProgress,
        currentClip.motion,
        'ease-out'
      )
    }
  }
}

// FFmpegによる動画生成
export class VideoGenerator {
  private ffmpeg: FFmpeg | null = null
  private loaded = false

  async load(onProgress?: (message: string) => void) {
    if (this.loaded) return

    this.ffmpeg = new FFmpeg()
    
    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })

    this.ffmpeg.on('progress', ({ progress }) => {
      onProgress?.(`エンコード中... ${Math.round(progress * 100)}%`)
    })

    // FFmpegをロード
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    this.loaded = true
  }

  async generateVideo(
    images: UploadedImage[],
    audioFile: File,
    editingPlan: EditingPlan,
    aspectRatio: AspectRatio,
    startTime: number,
    endTime: number,
    fps: number = 30,
    onProgress?: (message: string, progress: number) => void
  ): Promise<Blob> {
    if (!this.ffmpeg) {
      throw new Error('FFmpeg not loaded')
    }

    const { width, height } = RESOLUTIONS[aspectRatio]
    const duration = endTime - startTime
    const totalFrames = Math.ceil(duration * fps)

    onProgress?.('画像を準備中...', 0)

    // Canvasを作成
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 画像を安全にロード（Blob URLが失敗した場合はFileから再読み込み）
    const loadedImages = await Promise.all(
      images.map(img => loadImageSafe(img))
    )

    onProgress?.('フレームを生成中...', 10)

    // フレームを生成してFFmpegに書き込み
    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        // 編集計画は0秒から始まるので、フレーム位置のみで計算
        const currentTime = frame / fps
        
        // フレームを描画
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)

        const clips = editingPlan.clips
        let currentClipIndex = clips.findIndex(
          clip => currentTime >= clip.startTime && currentTime < clip.endTime
        )

        if (currentClipIndex === -1) {
          currentClipIndex = clips.length - 1
        }

        const currentClip = clips[currentClipIndex]
        if (currentClip) {
          const currentImage = loadedImages[currentClip.imageIndex]
          if (currentImage) {
            const clipDuration = currentClip.endTime - currentClip.startTime
            const clipProgress = (currentTime - currentClip.startTime) / clipDuration
            const transitionDuration = currentClip.transition.duration
            const transitionProgress = transitionDuration > 0 
              ? Math.min(1, (currentTime - currentClip.startTime) / transitionDuration)
              : 1

            if (transitionProgress < 1 && currentClipIndex > 0) {
              const prevClip = clips[currentClipIndex - 1]
              const prevImage = loadedImages[prevClip?.imageIndex]
              
              drawTransition(
                ctx,
                prevImage || null,
                currentImage,
                width,
                height,
                transitionProgress,
                currentClip.transition.type
              )
            } else {
              drawImageWithMotion(
                ctx,
                currentImage,
                width,
                height,
                clipProgress,
                currentClip.motion,
                'ease-out'
              )
            }
          }
        }

        // フレームをPNGとして保存（toDataURLを使用してメモリ問題を回避）
        const dataUrl = canvas.toDataURL('image/png')
        const base64Data = dataUrl.split(',')[1]
        const binaryString = atob(base64Data)
        const frameData = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          frameData[i] = binaryString.charCodeAt(i)
        }
        const frameName = `frame${String(frame).padStart(6, '0')}.png`
        await this.ffmpeg!.writeFile(frameName, frameData)

        // 進捗報告（10% - 70%）
        const frameProgress = 10 + (frame / totalFrames) * 60
        if (frame % Math.ceil(totalFrames / 20) === 0) {
          onProgress?.(`フレーム生成中... ${frame}/${totalFrames}`, frameProgress)
        }
      } catch (frameError) {
        console.error(`Error at frame ${frame}:`, frameError)
        throw new Error(`フレーム ${frame} の生成中にエラーが発生しました: ${frameError instanceof Error ? frameError.message : String(frameError)}`)
      }
    }

    onProgress?.('音源を準備中...', 70)

    // 音源を書き込み（fetchFileを使わずに直接arrayBufferを取得）
    let audioData: Uint8Array
    try {
      const arrayBuffer = await audioFile.arrayBuffer()
      audioData = new Uint8Array(arrayBuffer)
    } catch (e) {
      console.error('Failed to read audio file directly, this should not happen:', e)
      throw new Error('音声ファイルの読み込みに失敗しました')
    }
    await this.ffmpeg.writeFile('audio_full.mp3', audioData)

    // 音源を指定範囲でトリミング
    await this.ffmpeg.exec([
      '-i', 'audio_full.mp3',
      '-ss', String(startTime),
      '-t', String(duration),
      '-c:a', 'libmp3lame',
      '-y',
      'audio.mp3'
    ])

    onProgress?.('動画をエンコード中...', 75)

    // FFmpegで動画生成（トリミング済み音源を使用）
    await this.ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame%06d.png',
      '-i', 'audio.mp3',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-y',
      'output.mp4'
    ])

    onProgress?.('完了！', 100)

    // 出力を取得
    const data = await this.ffmpeg.readFile('output.mp4')
    
    // クリーンアップ
    for (let frame = 0; frame < totalFrames; frame++) {
      const frameName = `frame${String(frame).padStart(6, '0')}.png`
      await this.ffmpeg.deleteFile(frameName).catch(() => {})
    }
    await this.ffmpeg.deleteFile('audio_full.mp3').catch(() => {})
    await this.ffmpeg.deleteFile('audio.mp3').catch(() => {})
    await this.ffmpeg.deleteFile('output.mp4').catch(() => {})

    // FileDataをBlobに変換
    let bytes: Uint8Array
    if (typeof data === 'string') {
      // Base64文字列の場合
      const binaryString = atob(data)
      bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
    } else {
      // Uint8Arrayの場合 - 新しいUint8Arrayにコピーして型を確定させる
      const srcArray = data as Uint8Array
      bytes = new Uint8Array(srcArray.length)
      bytes.set(srcArray)
    }
    // @ts-ignore - TypeScript 5.9の厳密な型チェックを回避
    return new Blob([bytes], { type: 'video/mp4' })
  }
}

// シングルトンインスタンス
let videoGeneratorInstance: VideoGenerator | null = null

export function getVideoGenerator(): VideoGenerator {
  if (!videoGeneratorInstance) {
    videoGeneratorInstance = new VideoGenerator()
  }
  return videoGeneratorInstance
}