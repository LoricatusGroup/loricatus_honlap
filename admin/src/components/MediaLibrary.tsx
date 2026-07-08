import { useEffect, useState } from 'react'
import { supabase, SITE_ID } from '../lib/supabase'

interface Asset {
  url: string
  filename: string
}

interface Props {
  value: string
  onPick: (url: string) => void
}

// Grid of the tenant's previously uploaded images. Picking one sets the value,
// so an image can be reused without re-uploading.
export default function MediaLibrary({ value, onPick }: Props) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('assets')
      .select('url, filename')
      .eq('site_id', SITE_ID)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setFailed(true)
        else setAssets((data ?? []) as Asset[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return null
  if (assets === null) {
    return <p className="text-xs text-gray-500">Feltöltött képek betöltése…</p>
  }
  if (assets.length === 0) {
    return <p className="text-xs text-gray-500">Még nincs feltöltött kép.</p>
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-400">Feltöltött képek</p>
      <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
        {assets.map((a) => {
          const active = a.url === value
          return (
            <button
              key={a.url}
              type="button"
              title={a.filename}
              onClick={() => onPick(a.url)}
              className={`relative aspect-square overflow-hidden rounded-lg border transition ${
                active
                  ? 'border-blue-500 ring-2 ring-blue-500/40'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <img
                src={a.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.opacity = '0.2'
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
