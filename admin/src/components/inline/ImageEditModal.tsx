import { useState } from 'react'
import ImageUploader from '../ImageUploader'

interface Props {
  label: string
  initialValue: string
  onSave: (url: string) => void
  onClose: () => void
}

export default function ImageEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4 text-white">{label}</h3>
        <ImageUploader value={value} onChange={setValue} />
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Mégse
          </button>
          <button
            onClick={() => {
              onSave(value)
              onClose()
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  )
}
