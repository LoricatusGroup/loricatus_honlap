import { useEffect, useState } from 'react'
import Modal from './inline/Modal'
import { listPageVersions, restorePageVersion, type PageVersion } from '../lib/versions'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Who made the snapshot — the email captured at publish time, trimmed to the
// local part so the list stays readable (full address shown on hover).
function whoLabel(email: string | null): { short: string; full: string } {
  const full = (email || '').trim()
  if (!full) return { short: 'ismeretlen', full: 'ismeretlen szerző' }
  return { short: full.split('@')[0], full }
}

interface Props {
  pageSlug: string
  pageLabel: string
  localeLabel: string
  onClose: () => void
  // Called after a successful restore so the editor reloads the live content.
  onRestored: (info: string) => void
}

export default function VersionHistory({
  pageSlug,
  pageLabel,
  localeLabel,
  onClose,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<PageVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setVersions(null)
    setError(null)
    listPageVersions(pageSlug).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message)
      else setVersions((data as PageVersion[]) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [pageSlug])

  const handleRestore = async (v: PageVersion) => {
    const when = fmtWhen(v.created_at)
    if (
      !window.confirm(
        `Biztosan visszaállítod ezt a mentett verziót (${when})?\n\n` +
          `A jelenlegi (nem publikált) szerkesztéseid helyére a kiválasztott verzió ` +
          `tartalma kerül. Ez nem publikál — a visszaállítás után átnézheted, majd ` +
          `a Publikálás gombbal teheted élővé.`,
      )
    )
      return
    setRestoringId(v.id)
    setError(null)
    const { error } = await restorePageVersion(v.id)
    setRestoringId(null)
    if (error) {
      setError(`A visszaállítás nem sikerült: ${error.message}`)
      return
    }
    onRestored(`Verzió visszaállítva (${when}). Nézd át, majd publikáld, ha jó.`)
  }

  return (
    <Modal
      label="Verziók és visszaállítás"
      caption={
        <>
          Minden publikáláskor mentünk egy pillanatképet erről az oldalról
          (<strong>{pageLabel}</strong> · {localeLabel}) — ki, mikor és mit tett közzé.
          Bármelyikre egy kattintással visszaállhatsz.
        </>
      }
      maxWidth="max-w-2xl"
      onClose={onClose}
      footer={
        <button type="button" className="cms-btn-ghost" onClick={onClose}>
          Bezárás
        </button>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {versions === null && !error && (
        <div className="py-8 text-center text-sm text-gray-400">Előzmény betöltése…</div>
      )}

      {versions !== null && versions.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400">
          Erről az oldalról még nincs mentett verzió. Az első publikálás után jelenik
          meg itt az első pillanatkép.
        </div>
      )}

      {versions !== null && versions.length > 0 && (
        <ul className="divide-y divide-white/10">
          {versions.map((v, i) => {
            const who = whoLabel(v.created_by_email)
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    {fmtWhen(v.created_at)}
                    {i === 0 && (
                      <span className="rounded-full bg-lime-soft px-2 py-0.5 text-[10px] font-semibold text-lime">
                        legutóbbi
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-400" title={who.full}>
                    Publikálta: {who.short}
                    {v.note ? ` · ${v.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="cms-btn-secondary shrink-0 !px-3 !py-1.5 !text-sm"
                  disabled={restoringId !== null}
                  onClick={() => handleRestore(v)}
                >
                  {restoringId === v.id ? 'Visszaállítás…' : '↺ Visszaállítás'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
