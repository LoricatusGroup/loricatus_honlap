import { useState } from 'react'

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

export default function NumberEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      onClose()
      return
    }
    onSave(trimmed)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2 text-white">{label}</h3>
        <p className="text-xs text-gray-400 mb-4">
          Egész szám. Az animáció 0-tól ezig fog számolni új oldalbetöltéskor.
        </p>
        <input
          autoFocus
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Mégse
          </button>
          <button
            onClick={commit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  )
}
