import { useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  value: string
  onChange: (url: string) => void
}

export default function ImageUploader({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-')
    const filename = `${Date.now()}-${safeName}`

    const { data, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filename, file)

    if (uploadError || !data) {
      setError(uploadError?.message ?? 'Feltöltés sikertelen')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(data.path)
    onChange(urlData.publicUrl)

    await supabase.from('assets').insert({
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
    })

    setUploading(false)
  }

  return (
    <div className="space-y-2">
      {value && (
        <img
          src={value}
          alt=""
          className="max-w-xs h-32 object-cover rounded border border-gray-600"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.opacity = '0.3'
          }}
        />
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Kép URL vagy töltsd fel jobbra →"
          className="flex-1 px-3 py-2 bg-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm whitespace-nowrap">
          {uploading ? 'Feltöltés…' : 'Feltöltés'}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
