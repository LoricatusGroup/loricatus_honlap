import { useState } from 'react'
import Modal from './Modal'
import { toEmbedUrl } from '../../lib/video'

interface Props {
  label: string
  initialValue: string
  onSave: (url: string) => void
  onClose: () => void
}

// Paste a YouTube/Vimeo link; we store the raw URL and the pipeline turns it
// into an embed. Shows a live preview so the owner sees it worked.
export default function VideoEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const embed = toEmbedUrl(value)
  const invalid = value.trim() !== '' && embed === ''

  return (
    <Modal
      label={label}
      caption="Illeszd be egy YouTube vagy Vimeo videó linkjét — a videó beágyazva jelenik meg."
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
            disabled={invalid}
          >
            Mentés
          </button>
        </>
      }
    >
      <label className="mb-1 block text-xs text-gray-300">Videó linkje</label>
      <input
        className="cms-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…  vagy  https://vimeo.com/…"
        autoFocus
      />
      {invalid && (
        <p className="mt-2 text-xs text-red-300">
          Ez nem tűnik YouTube vagy Vimeo linknek. Másold be a videó oldaláról a teljes linket.
        </p>
      )}
      {embed && (
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
      {!value.trim() && (
        <p className="mt-3 text-[11px] text-gray-400">
          Tipp: a YouTube „Megosztás" gombjánál vagy a böngésző címsorából másolt link is jó.
        </p>
      )}
    </Modal>
  )
}
