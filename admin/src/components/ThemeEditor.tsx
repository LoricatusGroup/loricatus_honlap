interface Props {
  theme: Record<string, string>
  onChange: (theme: Record<string, string>) => void
}

const THEME_KEYS = [
  { key: 'accent', label: 'Kiemelő szín' },
  { key: 'bg', label: 'Háttérszín' },
  { key: 'text', label: 'Szövegszín' },
] as const

export default function ThemeEditor({ theme, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {THEME_KEYS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-sm text-gray-300 mb-2">{label}</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={theme[key] || '#000000'}
              onChange={(e) => onChange({ ...theme, [key]: e.target.value })}
              className="h-10 w-16 bg-gray-700 rounded cursor-pointer"
            />
            <input
              type="text"
              value={theme[key] || ''}
              onChange={(e) => onChange({ ...theme, [key]: e.target.value })}
              className="flex-1 px-3 py-2 bg-gray-700 rounded text-white text-sm font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
