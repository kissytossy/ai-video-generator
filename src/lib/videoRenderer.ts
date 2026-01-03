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
      const panX = drawWidth * intensity * easedProgress
      offsetX -= panX
      break
    }
    case 'pan-right': {
      const panX = drawWidth * intensity * easedProgress
      offsetX += panX
      break
    }
    case 'pan-up': {
      const panY = drawHeight * intensity * easedProgress
      offsetY -= panY
      break
    }
    case 'pan-down': {
      const panY = drawHeight * intensity * easedProgress
      offsetY += panY
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

  switch (transitionType) {
    case 'fade':
    case 'dissolve':
      // フェードイン/アウト（dissolveはfadeと同じ）
      if (imgFrom) {
        ctx.globalAlpha = 1 - progress
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
      }
      ctx.globalAlpha = progress
      drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      break

    case 'slide':
    case 'slide-left':
      // スライド（左方向）
      if (imgFrom) {
        ctx.save()
        ctx.translate(-canvasWidth * progress, 0)
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
        ctx.restore()
        
        ctx.save()
        ctx.translate(canvasWidth * (1 - progress), 0)
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
        ctx.restore()
      } else {
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      }
      break

    case 'slide-right':
      // スライド（右方向）
      if (imgFrom) {
        ctx.save()
        ctx.translate(canvasWidth * progress, 0)
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
        ctx.restore()
        
        ctx.save()
        ctx.translate(-canvasWidth * (1 - progress), 0)
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
        ctx.restore()
      } else {
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      }
      break

    case 'slide-up':
      // スライド（上方向）
      if (imgFrom) {
        ctx.save()
        ctx.translate(0, -canvasHeight * progress)
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
        ctx.restore()
        
        ctx.save()
        ctx.translate(0, canvasHeight * (1 - progress))
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
        ctx.restore()
      } else {
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      }
      break

    case 'slide-down':
      // スライド（下方向）
      if (imgFrom) {
        ctx.save()
        ctx.translate(0, canvasHeight * progress)
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
        ctx.restore()
        
        ctx.save()
        ctx.translate(0, -canvasHeight * (1 - progress))
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
        ctx.restore()
      } else {
        drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      }
      break

    case 'wipe':
      // ワイプ
      if (imgFrom) {
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, canvasWidth * progress, canvasHeight)
      ctx.clip()
      drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      ctx.restore()
      break

    case 'zoom':
      // ズームトランジション
      if (imgFrom) {
        ctx.globalAlpha = 1 - progress
        const scaleFrom = 1 + progress * 0.2
        ctx.save()
        ctx.translate(canvasWidth / 2, canvasHeight / 2)
        ctx.scale(scaleFrom, scaleFrom)
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2)
        drawImageWithMotion(ctx, imgFrom, canvasWidth, canvasHeight, 1, { type: 'static', intensity: 0 })
        ctx.restore()
      }
      ctx.globalAlpha = progress
      const scaleTo = 1.2 - progress * 0.2
      ctx.save()
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.scale(scaleTo, scaleTo)
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2)
      drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      ctx.restore()
      break

    case 'cut':
    default:
      // カット（即座に切り替え）
      drawImageWithMotion(ctx, imgTo, canvasWidth, canvasHeight, 0, { type: 'static', intensity: 0 })
      break
  }

  ctx.restore()
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
      uploadedImages.map(img => loadImage(img.preview))
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

    // 画像をロード
    const loadedImages = await Promise.all(
      images.map(img => loadImage(img.preview))
    )

    onProgress?.('フレームを生成中...', 10)

    // フレームを生成してFFmpegに書き込み
    for (let frame = 0; frame < totalFrames; frame++) {
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

      // フレームをPNGとして保存
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })
      const frameData = new Uint8Array(await blob.arrayBuffer())
      const frameName = `frame${String(frame).padStart(6, '0')}.png`
      await this.ffmpeg!.writeFile(frameName, frameData)

      // 進捗報告（10% - 70%）
      const frameProgress = 10 + (frame / totalFrames) * 60
      if (frame % Math.ceil(totalFrames / 20) === 0) {
        onProgress?.(`フレーム生成中... ${frame}/${totalFrames}`, frameProgress)
      }
    }

    onProgress?.('音源を準備中...', 70)

    // 音源を書き込み
    const audioData = await fetchFile(audioFile)
    await this.ffmpeg.writeFile('audio.mp3', audioData)

    onProgress?.('動画をエンコード中...', 75)

    // FFmpegで動画生成
    // -ss は音源の入力ファイルの前に置いて、指定位置から開始
    await this.ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame%06d.png',
      '-ss', String(startTime),
      '-i', 'audio.mp3',
      '-t', String(duration),
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