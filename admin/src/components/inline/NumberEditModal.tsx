import { useState } from 'react'
import Modal from './Modal'

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
    <Modal
      label={label}
      maxWidth="max-w-sm"
      caption="Egész szám. Az animáció 0-tól eddig fog számolni új oldalbetöltéskor."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="cms-btn-ghost">
            Mégse
          </button>
          <button onClick={commit} className="cms-btn-primary">
            Mentés
          </button>
        </>
      }
    >
      <input
        autoFocus
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        className="cms-input text-lg"
      />
    </Modal>
  )
}
