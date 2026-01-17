'use client'

export type GenerationMode = 'manual' | 'auto'

interface Props {
  mode: GenerationMode
  setMode: (mode: GenerationMode) => void
  withLyrics?: boolean
  setWithLyrics?: (withLyrics: boolean) => void
}

export default function ModeSelector({ mode, setMode, withLyrics = false, setWithLyrics }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🎬 生成モード</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
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
          <div className="font-semibold text-gray-900">AIで曲を生成</div>
          <div className="text-sm text-gray-500 mt-1">
            画像に合った曲を自動作成
          </div>
        </button>
      </div>

      {/* 歌詞オプション（自動モードのみ表示） */}
      {mode === 'auto' && setWithLyrics && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">🎤 歌詞オプション</h4>
          <div className="flex gap-3">
            <button
              onClick={() => setWithLyrics(false)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all text-center ${
                !withLyrics
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="text-lg mb-1">🎹</div>
              <div className="text-sm font-medium">インスト</div>
              <div className="text-xs text-gray-500">歌詞なし</div>
            </button>
            <button
              onClick={() => setWithLyrics(true)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all text-center ${
                withLyrics
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="text-lg mb-1">🎤</div>
              <div className="text-sm font-medium">ボーカル</div>
              <div className="text-xs text-gray-500">歌詞あり</div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
