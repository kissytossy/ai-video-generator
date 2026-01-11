'use client'

export type GenerationMode = 'manual' | 'auto'

interface Props {
  mode: GenerationMode
  setMode: (mode: GenerationMode) => void
}

export default function ModeSelector({ mode, setMode }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🎬 生成モード</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* 手動モード */}
        <button
          onClick={() => setMode('manual')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            mode === 'manual'
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-2xl mb-2">🎵</div>
          <div className="font-semibold text-gray-900">自分の曲を使う</div>
          <div className="text-sm text-gray-500 mt-1">
            画像と音源をアップロード
          </div>
        </button>

        {/* 自動モード */}
        <button
          onClick={() => setMode('auto')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            mode === 'auto'
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-2xl mb-2">🤖</div>
          <div className="font-semibold text-gray-900">AI自動生成</div>
          <div className="text-sm text-gray-500 mt-1">
            画像のみでAIが曲を作成
          </div>
          <div className="text-xs text-primary-600 mt-1 font-medium">
            ✨ NEW
          </div>
        </button>
      </div>

      {mode === 'auto' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>AI自動生成モード:</strong><br />
            画像をアップロードするだけで、AIが画像の雰囲気を分析し、それに合った曲を自動作成します。
          </p>
        </div>
      )}
    </div>
  )
}