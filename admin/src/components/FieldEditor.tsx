import type { EditableField } from '../lib/types'
import ImageUploader from './ImageUploader'

interface Props {
  field: EditableField
  onChange: (value: string) => void
}

export default function FieldEditor({ field, onChange }: Props) {
  const isChanged = field.value !== field.defaultValue

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-sm font-medium text-gray-300">
          {field.label}
          {isChanged && <span className="ml-2 text-xs text-yellow-400">● módosítva</span>}
        </label>
        <span className="text-xs text-gray-500 font-mono">{field.key}</span>
      </div>

      {field.type === 'text' && (
        <input
          type="text"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {field.type === 'html' && (
        <textarea
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {field.type === 'image' && <ImageUploader value={field.value} onChange={onChange} />}

      {field.type === 'href' && (
        <input
          type="text"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL vagy #horgony"
          className="w-full px-3 py-2 bg-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {field.type === 'color' && (
        <input
          type="color"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-20 bg-gray-700 rounded cursor-pointer"
        />
      )}

      {field.type === 'target' && (
        <input
          type="number"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          min="0"
          className="w-32 px-3 py-2 bg-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {field.type === 'content' && (
        <textarea
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}
