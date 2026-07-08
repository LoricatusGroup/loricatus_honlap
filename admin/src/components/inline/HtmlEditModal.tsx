import { useEffect, useRef } from 'react'
import Modal from './Modal'

interface Props {
  label: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

// Strip attributes/tags that could leak in via paste or execCommand output so
// the stored HTML stays clean and on-theme. Editors are trusted (allowlisted
// staff), so this is hygiene, not a security boundary.
function cleanHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
    if (['SCRIPT', 'STYLE', 'IFRAME'].includes(el.tagName)) el.remove()
  })
  // Treat a visually-empty editor (e.g. a lone <br>) as no content so the
  // published disclosure stays hidden.
  if (!tmp.textContent?.trim() && !tmp.querySelector('img, li')) return ''
  return tmp.innerHTML.trim()
}

const toolBtn =
  'cms-btn-secondary !px-2.5 !py-1 !text-sm'

export default function HtmlEditModal({ label, initialValue, onSave, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = initialValue
    el.focus()
  }, [initialValue])

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const addLink = () => {
    const url = window.prompt('Link címe (URL):', 'https://')
    if (url) exec('createLink', url)
  }

  const save = () => {
    onSave(cleanHtml(editorRef.current?.innerHTML ?? ''))
    onClose()
  }

  return (
    <Modal
      label={label}
      maxWidth="max-w-2xl"
      caption="Formázott szöveg — jelöld ki a szöveget, majd használd a gombokat."
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
      {/* Toolbar. onMouseDown + preventDefault keeps the text selection. */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" title="Félkövér" className={`${toolBtn} font-bold`}
          onMouseDown={(e) => { e.preventDefault(); exec('bold') }}>B</button>
        <button type="button" title="Dőlt" className={`${toolBtn} italic`}
          onMouseDown={(e) => { e.preventDefault(); exec('italic') }}>I</button>
        <button type="button" title="Felsorolás" className={toolBtn}
          onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}>• Lista</button>
        <button type="button" title="Link beszúrása" className={toolBtn}
          onMouseDown={(e) => { e.preventDefault(); addLink() }}>🔗 Link</button>
        <button type="button" title="Formázás törlése" className={toolBtn}
          onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); exec('unlink') }}>⌫ Formázás</button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="cms-input min-h-[160px] max-h-[50vh] overflow-y-auto leading-relaxed [&_a]:text-blue-300 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </Modal>
  )
}
