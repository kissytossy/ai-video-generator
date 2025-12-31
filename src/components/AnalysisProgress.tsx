'use client'

interface Props {
  isAnalyzing: boolean
  progress: number
  currentStep: string
  error: string | null
}

export default function AnalysisProgress({ isAnalyzing, progress, currentStep, error }: Props) {
  if (!isAnalyzing && !error) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {error ? (
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              エラーが発生しました
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              もう一度お試しいただくか、画像/音源を変更してください。
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-4 animate-pulse">🤖</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AIが分析中...
              </h3>
              <p className="text-gray-600">{currentStep}</p>
            </div>

            {/* プログレスバー */}
            <div className="mb-4">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>進捗</span>
                <span>{progress}%</span>
              </div>
            </div>

            {/* ステップ表示 */}
            <div className="space-y-2">
              <StepItem 
                label="画像分析" 
                status={progress < 30 ? 'active' : 'done'} 
              />
              <StepItem 
                label="音源分析" 
                status={progress < 30 ? 'pending' : progress < 60 ? 'active' : 'done'} 
              />
              <StepItem 
                label="編集計画生成" 
                status={progress < 60 ? 'pending' : progress < 100 ? 'active' : 'done'} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StepItem({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center text-sm
        ${status === 'done' ? 'bg-green-500 text-white' : 
          status === 'active' ? 'bg-primary-500 text-white animate-pulse' : 
          'bg-gray-200 text-gray-400'}
      `}>
        {status === 'done' ? '✓' : status === 'active' ? '⋯' : '○'}
      </div>
      <span className={`
        ${status === 'done' ? 'text-green-600' : 
          status === 'active' ? 'text-primary-600 font-medium' : 
          'text-gray-400'}
      `}>
        {label}
      </span>
    </div>
  )
}
