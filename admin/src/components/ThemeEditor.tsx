import { THEME_KEYS, DEFAULT_THEME } from '../lib/theme'

interface Props {
  theme: Record<string, string>
  onChange: (theme: Record<string, string>) => void
}

export default function ThemeEditor({ theme, onChange }: Props) {
  const setKey = (key: string, value: string) => onChange({ ...theme, [key]: value })
  const resetKey = (key: string) => {
    const next = { ...theme }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {THEME_KEYS.map(({ key, label, hint }) => {
        const fallback = DEFAULT_THEME[key]
        const current = theme[key] || fallback
        const isCustom =
          !!theme[key] && theme[key].toLowerCase() !== fallback.toLowerCase()
        return (
          <div key={key} className="bg-gray-900/40 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-200">{label}</label>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => resetKey(key)}
                  className="text-[11px] text-gray-400 hover:text-white underline"
                  title="Vissza az alap színre"
                >
                  alap
                </button>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={current}
                onChange={(e) => setKey(key, e.target.value)}
                className="h-10 w-14 shrink-0 bg-gray-700 rounded cursor-pointer"
              />
              <input
                type="text"
                value={theme[key] ?? ''}
                onChange={(e) => setKey(key, e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 bg-gray-700 rounded text-white text-sm font-mono"
                placeholder={fallback}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
          </div>
        )
      })}
    </div>
  )
}
