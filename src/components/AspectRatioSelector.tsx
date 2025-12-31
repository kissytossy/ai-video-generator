'use client'

import { AspectRatio, AspectRatioOption } from '@/types'

const options: AspectRatioOption[] = [
  {
    value: '16:9',
    label: 'YouTube',
    description: '16:9（横長）',
    width: 1920,
    height: 1080,
  },
  {
    value: '1:1',
    label: 'Instagram投稿',
    description: '1:1（正方形）',
    width: 1080,
    height: 1080,
  },
  {
    value: '4:5',
    label: 'Instagram縦',
    description: '4:5（縦長）',
    width: 1080,
    height: 1350,
  },
  {
    value: '9:16',
    label: 'リール/ストーリー',
    description: '9:16（縦型）',
    width: 1080,
    height: 1920,
  },
]

interface Props {
  selected: AspectRatio
  onChange: (ratio: AspectRatio) => void
}

export default function AspectRatioSelector({ selected, onChange }: Props) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        📐 アスペクト比
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              selected === option.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {/* アスペクト比プレビュー */}
              <div 
                className={`bg-gray-300 rounded-sm ${
                  option.value === '16:9' ? 'w-6 h-3.5' :
                  option.value === '1:1' ? 'w-4 h-4' :
                  option.value === '4:5' ? 'w-4 h-5' :
                  'w-3.5 h-6'
                } ${selected === option.value ? 'bg-primary-400' : ''}`}
              />
              <span className={`text-sm font-medium ${
                selected === option.value ? 'text-primary-700' : 'text-gray-700'
              }`}>
                {option.label}
              </span>
            </div>
            <p className={`text-xs ${
              selected === option.value ? 'text-primary-600' : 'text-gray-500'
            }`}>
              {option.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
