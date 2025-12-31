import { NextRequest, NextResponse } from 'next/server'
import { callClaude, IMAGE_ANALYSIS_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 60 // 最大60秒

interface ImageAnalysisResult {
  scene: string
  mood: string
  genre: string
  dominantColors: string[]
  visualIntensity: number
  suggestedDuration: 'short' | 'medium' | 'long'
  motionSuggestion: string
  tags: string[]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const images = formData.getAll('images') as File[]

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    const results: ImageAnalysisResult[] = []

    // 各画像を分析（並列処理）
    const analysisPromises = images.map(async (image, index) => {
      // 画像をBase64に変換
      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = image.type || 'image/jpeg'

      // Claude APIで分析
      const response = await callClaude(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'この画像を分析してください。',
              },
            ],
          },
        ],
        IMAGE_ANALYSIS_PROMPT
      )

      // JSONをパース
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]) as ImageAnalysisResult
          return { index, analysis }
        }
      } catch (parseError) {
        console.error(`Failed to parse analysis for image ${index}:`, parseError)
      }

      // パース失敗時のデフォルト値
      return {
        index,
        analysis: {
          scene: 'その他',
          mood: '穏やか',
          genre: 'その他',
          dominantColors: ['#888888'],
          visualIntensity: 5,
          suggestedDuration: 'medium' as const,
          motionSuggestion: 'static',
          tags: [],
        },
      }
    })

    const analysisResults = await Promise.all(analysisPromises)
    
    // インデックス順にソート
    analysisResults.sort((a, b) => a.index - b.index)
    
    return NextResponse.json({
      success: true,
      analyses: analysisResults.map(r => r.analysis),
    })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze images', details: String(error) },
      { status: 500 }
    )
  }
}
