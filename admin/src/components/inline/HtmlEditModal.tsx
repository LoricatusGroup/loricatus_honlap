import { useEffect, useRef } from 'react'

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

const btnCls = 'px-2.5 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white'

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1 text-white">{label}</h3>
        <p className="text-xs text-gray-400 mb-3">
          Formázott szöveg — jelöld ki a szöveget, majd használd a gombokat.
        </p>

        {/* Toolbar. onMouseDown + preventDefault keeps the text selection. */}
        <div className="flex flex-wrap gap-1 mb-2">
          <button type="button" title="Félkövér" className={`${btnCls} font-bold`}
            onMouseDown={(e) => { e.preventDefault(); exec('bold') }}>B</button>
          <button type="button" title="Dőlt" className={`${btnCls} italic`}
            onMouseDown={(e) => { e.preventDefault(); exec('italic') }}>I</button>
          <button type="button" title="Felsorolás" className={btnCls}
            onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}>• Lista</button>
          <button type="button" title="Link beszúrása" className={btnCls}
            onMouseDown={(e) => { e.preventDefault(); addLink() }}>🔗 Link</button>
          <button type="button" title="Formázás törlése" className={btnCls}
            onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); exec('unlink') }}>⌫ Formázás</button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="w-full min-h-[160px] max-h-[50vh] overflow-y-auto px-3 py-2 bg-gray-700 rounded text-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-300 [&_a]:underline"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Mégse
          </button>
          <button
            onClick={save}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  )
}
