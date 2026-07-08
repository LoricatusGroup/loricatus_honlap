import { useState } from 'react'
import Modal from './Modal'

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

export default function ContentEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const save = () => {
    onSave(value)
    onClose()
  }

  return (
    <Modal
      label={label}
      maxWidth="max-w-2xl"
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
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        className="cms-input resize-y leading-relaxed"
      />
    </Modal>
  )
}
