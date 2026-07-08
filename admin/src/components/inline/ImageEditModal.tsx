import { useState } from 'react'
import Modal from './Modal'
import ImageUploader from '../ImageUploader'

interface Props {
  label: string
  initialValue: string
  onSave: (url: string) => void
  onClose: () => void
}

export default function ImageEditModal({ label, initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <Modal
      label={label}
      caption="Adj meg egy kép-URL-t, vagy tölts fel egy új képet."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="cms-btn-ghost">
            Mégse
          </button>
          <button
            onClick={() => {
              onSave(value)
              onClose()
            }}
            className="cms-btn-primary"
          >
            Mentés
          </button>
        </>
      }
    >
      <ImageUploader value={value} onChange={setValue} />
    </Modal>
  )
}
