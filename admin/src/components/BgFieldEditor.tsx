import ImageUploader from './ImageUploader'

// A háttérkép nem <img>, hanem inline background-* tulajdonságok halmaza, ezért
// a mező három részt hordoz: "url | pozíció | méret". A szerkesztő ugyanazt a
// képválasztót adja, mint a sima képmezők, plusz két legördülőt.
const POSITIONS: Array<[string, string]> = [
  ['center', 'Középre'],
  ['top', 'Felülre'],
  ['bottom', 'Alulra'],
  ['left', 'Balra'],
  ['right', 'Jobbra'],
  ['top left', 'Bal felső'],
  ['top right', 'Jobb felső'],
  ['bottom left', 'Bal alsó'],
  ['bottom right', 'Jobb alsó'],
]

const SIZES: Array<[string, string]> = [
  ['cover', 'Kitölti a keretet (levág)'],
  ['contain', 'Teljesen belefér (marad üres hely)'],
  ['auto', 'Eredeti méret'],
  ['100% 100%', 'Kifeszítve (torzulhat)'],
]

interface Props {
  value: string
  onChange: (value: string) => void
}

export function parseBg(value: string): { url: string; position: string; size: string } {
  const [url = '', position = '', size = ''] = String(value).split('|').map((s) => s.trim())
  return { url, position: position || 'center', size: size || 'cover' }
}

export default function BgFieldEditor({ value, onChange }: Props) {
  const { url, position, size } = parseBg(value)
  const emit = (next: Partial<{ url: string; position: string; size: string }>) =>
    onChange(
      `${next.url ?? url} | ${next.position ?? position} | ${next.size ?? size}`,
    )

  const selectCls =
    'w-full px-3 py-2 bg-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime'

  return (
    <div className="space-y-3">
      <ImageUploader value={url} onChange={(u) => emit({ url: u })} />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Kivágás helye</span>
          <select
            value={POSITIONS.some(([v]) => v === position) ? position : 'center'}
            onChange={(e) => emit({ position: e.target.value })}
            className={selectCls}
          >
            {POSITIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Méretezés</span>
          <select
            value={SIZES.some(([v]) => v === size) ? size : 'cover'}
            onChange={(e) => emit({ size: e.target.value })}
            className={selectCls}
          >
            {SIZES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
