import { useState } from 'react'

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

export default function HtmlEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2 text-white">{label}</h3>
        <p className="text-xs text-gray-400 mb-4">
          HTML szerkesztés. Sortörés: <code className="text-gray-300">&lt;br/&gt;</code> ·
          félkövér: <code className="text-gray-300">&lt;strong&gt;…&lt;/strong&gt;</code>
        </p>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-4">
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
