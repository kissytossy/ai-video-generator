'use client'

import { useCallback, useState, useRef } from 'react'
import { UploadedImage } from '@/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  images: UploadedImage[]
  setImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>
}

// ソート可能な画像アイテムコンポーネント
function SortableImageItem({ 
  image, 
  index, 
  onRemove 
}: { 
  image: UploadedImage
  index: number
  onRemove: (id: string) => void 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // ダブルタップ検出用
  const lastTapRef = useRef<number>(0)

  // ダブルクリックで削除（PC）
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onRemove(image.id)
  }

  // ダブルタップで削除（モバイル）
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300 // 300ms以内のタップをダブルタップとみなす
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault()
      e.stopPropagation()
      onRemove(image.id)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      className={`relative group aspect-square rounded-lg overflow-hidden bg-gray-100 ${
        isDragging ? 'ring-2 ring-primary-500 ring-offset-2' : ''
      }`}
    >
      <img
        src={image.preview}
        alt={image.name}
        className="w-full h-full object-cover pointer-events-none"
      />
      {/* 順番表示 */}
      <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-medium">
        {index + 1}
      </div>
      {/* 削除ボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(image.id)
        }}
        className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-600 z-10"
      >
        ×
      </button>
      {/* ドラッグヒント */}
      <div 
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="text-white text-xs font-medium">ドラッグで並替</span>
      </div>
    </div>
  )
}

// ドラッグ中のオーバーレイ
function DragOverlayItem({ image }: { image: UploadedImage }) {
  return (
    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-2xl ring-2 ring-primary-500">
      <img
        src={image.preview}
        alt={image.name}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

export default function ImageUploader({ images, setImages }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const generateId = () => Math.random().toString(36).substring(2, 9)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px動かしてからドラッグ開始
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: UploadedImage[] = Array.from(files).map(file => ({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }))

    setImages(prev => [...prev, ...newImages])
    
    // inputをリセット（同じファイルを再度選択できるように）
    e.target.value = ''
  }, [setImages])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (!files) return

    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    )

    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }))

    setImages(prev => [...prev, ...newImages])
  }, [setImages])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [setImages])

  const activeImage = activeId ? images.find(img => img.id === activeId) : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">📷 画像</h3>
        <span className="text-sm text-gray-500">{images.length}枚</span>
      </div>

      {/* ドロップゾーン */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`drop-zone mb-4 cursor-pointer transition-all ${
          isDragOver ? 'border-primary-500 bg-primary-50 scale-[1.02]' : ''
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload" className="cursor-pointer">
          <span className="text-4xl mb-2 block">{isDragOver ? '📥' : '📁'}</span>
          <p className="text-gray-600 mb-1">
            {isDragOver ? 'ここにドロップ！' : 'ドラッグ&ドロップ または クリックで画像を追加'}
          </p>
          <p className="text-sm text-gray-400">
            JPEG, PNG, WebP対応 / 複数選択可
          </p>
        </label>
      </div>

      {/* 画像プレビュー一覧 */}
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {images.map((image, index) => (
                <SortableImageItem
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={removeImage}
                />
              ))}
              
              {/* 追加ボタン */}
              <label
                htmlFor="image-upload"
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <span className="text-2xl text-gray-400">+</span>
              </label>
            </div>
          </SortableContext>

          {/* ドラッグ中のオーバーレイ */}
          <DragOverlay>
            {activeImage ? (
              <div className="w-20 h-20">
                <DragOverlayItem image={activeImage} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {images.length > 1 && (
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
          <span>💡</span>
          <span>ドラッグで並び替え・ダブルクリックで削除</span>
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => {
              images.forEach(img => URL.revokeObjectURL(img.preview))
              setImages([])
            }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            すべて削除
          </button>
        </div>
      )}
    </div>
  )
}