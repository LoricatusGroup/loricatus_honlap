import { useState, type ChangeEvent } from 'react'
import { supabase, SITE_ID } from '../lib/supabase'

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
    // Tenant-scoped storage path ({site_id}/…) so uploads isolate per site and
    // pass the membership-scoped assets RLS / show up in the per-tenant backup.
    const filename = `${SITE_ID}/${Date.now()}-${safeName}`

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
      site_id: SITE_ID,
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
    })

    setUploading(false)
  }

  return (
    <div className="space-y-3">
      {/* Framed 16:9 preview */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25"
        style={{ aspectRatio: '16 / 9' }}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = '0.25'
            }}
          />
        ) : (
          <div className="grid h-full place-items-center text-center text-xs text-gray-500">
            <div>
              <div className="mb-1 text-2xl opacity-50">🖼️</div>
              Nincs kép megadva
            </div>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white">
            Feltöltés…
          </div>
        )}
      </div>

      {/* URL + upload */}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Kép URL, vagy tölts fel jobbra →"
          className="cms-input flex-1"
        />
        <label
          className={`cms-btn-secondary shrink-0 ${
            uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {uploading ? 'Feltöltés…' : '⬆ Feltöltés'}
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
