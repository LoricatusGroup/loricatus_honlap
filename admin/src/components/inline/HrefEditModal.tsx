import { useState } from 'react'
import Modal from './Modal'

export type PageLink = { label: string; url: string }

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
  pageLinks?: PageLink[]
}

export default function HrefEditModal({ label, initialValue, onSave, onClose, pageLinks = [] }: Props) {
  const [value, setValue] = useState(initialValue)
  const save = () => {
    onSave(value)
    onClose()
  }
  // Which known target (if any) the current value matches — keeps the dropdown in sync.
  const current = pageLinks.find((l) => l.url === value)?.url ?? ''

  return (
    <Modal
      label={label}
      maxWidth="max-w-md"
      caption={
        <>
          Válassz egy oldalt a listából, vagy írj be teljes URL-t (pl.{' '}
          <code>https://…</code>) / horgonyt (pl. <code>#contact</code>).
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="cms-btn-ghost">
            Mégse
          </button>
          <button onClick={save} className="cms-btn-primary">
            Mentés
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {pageLinks.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-gray-300">Ugrás egy oldalra</label>
            <select
              value={current}
              onChange={(e) => {
                if (e.target.value) setValue(e.target.value)
              }}
              className="cms-input"
            >
              <option value="">— Válassz belső célt… —</option>
              {pageLinks.map((l) => (
                <option key={l.url} value={l.url}>
                  {l.label} ({l.url})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-gray-300">
            Vagy egyéni cím (URL / horgony)
          </label>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            className="cms-input"
          />
        </div>
      </div>
    </Modal>
  )
}
