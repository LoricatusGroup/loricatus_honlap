import { useState } from 'react'
import Modal from './Modal'

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

export default function HrefEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const save = () => {
    onSave(value)
    onClose()
  }

  return (
    <Modal
      label={label}
      maxWidth="max-w-md"
      caption={
        <>
          Teljes URL (pl. <code>https://…</code>) vagy belső horgony (pl.{' '}
          <code>#contact</code>)
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
    </Modal>
  )
}
