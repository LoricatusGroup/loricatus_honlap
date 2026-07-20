import { useState, type ChangeEvent } from 'react'
import Modal from './Modal'
import { classifyVideo, toEmbedUrl } from '../../lib/video'
import { supabase, SITE_ID } from '../../lib/supabase'

interface Props {
  label: string
  initialValue: string
  onSave: (url: string) => void
  onClose: () => void
}

// Uploaded videos are stored whole and streamed from the browser, so keep them
// small — bigger clips belong on YouTube/Vimeo (embed) for proper streaming.
// Matches the assets bucket's 45 MB limit so we reject with a friendly message
// before the server would return a 413.
const MAX_MB = 45

// Paste a YouTube/Vimeo link OR upload a short video file. Embeds render in an
// iframe; uploaded files render in a <video>. Shows a live preview either way.
export default function VideoEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = classifyVideo(value)
  const embed = toEmbedUrl(value)
  const invalid = value.trim() !== '' && kind === 'none'

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `Ez a videó túl nagy (max ${MAX_MB} MB). Tömörítsd, vagy tölts fel YouTube/Vimeo linket helyette.`,
      )
      return
    }
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-')
    const filename = `${SITE_ID}/${Date.now()}-${safeName}`
    const { data, error: upErr } = await supabase.storage
      .from('assets')
      .upload(filename, file, { contentType: file.type || 'video/mp4' })
    if (upErr || !data) {
      setError(upErr?.message ?? 'Feltöltés sikertelen')
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(data.path)
    setValue(urlData.publicUrl)
    await supabase.from('assets').insert({
      site_id: SITE_ID,
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
    })
    setUploading(false)
  }

  return (
    <Modal
      label={label}
      caption="Illeszd be egy YouTube vagy Vimeo videó linkjét, vagy tölts fel egy saját (rövid) videófájlt."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="cms-btn-ghost">
            Mégse
          </button>
          <button
            onClick={() => {
              onSave(value.trim())
              onClose()
            }}
            className="cms-btn-primary"
            disabled={invalid || uploading}
          >
            Mentés
          </button>
        </>
      }
    >
      <label className="mb-1 block text-xs text-gray-300">Videó linkje vagy feltöltött fájl</label>
      <div className="flex gap-2">
        <input
          className="cms-input flex-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…  ·  vagy tölts fel jobbra →"
          autoFocus
        />
        <label
          className={`cms-btn-secondary shrink-0 ${
            uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {uploading ? 'Feltöltés…' : '⬆ Videó feltöltése'}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      {invalid && !error && (
        <p className="mt-2 text-xs text-red-300">
          Ez nem tűnik érvényes videónak. Illessz be egy YouTube/Vimeo linket, vagy tölts fel egy
          videófájlt (.mp4, .webm).
        </p>
      )}

      {kind === 'embed' && embed && (
        <div
          className="mt-4 overflow-hidden rounded-xl border border-white/10"
          style={{ position: 'relative', paddingTop: '56.25%' }}
        >
          <iframe
            src={embed}
            title="Előnézet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {kind === 'file' && (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            src={value}
            controls
            playsInline
            preload="metadata"
            className="block max-h-[280px] w-full"
          />
        </div>
      )}

      {!value.trim() && (
        <p className="mt-3 text-[11px] text-gray-400">
          Tipp: hosszabb videóhoz használj YouTube/Vimeo linket (jobb betöltés); a feltöltés rövid,
          max {MAX_MB} MB-os klipekhez való.
        </p>
      )}
    </Modal>
  )
}
