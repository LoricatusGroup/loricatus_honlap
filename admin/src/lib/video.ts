// Normalise a pasted YouTube/Vimeo URL into an embeddable player URL.
// Returns '' for anything we don't recognise, so only trusted providers can
// end up as an <iframe src> (no arbitrary-iframe injection). Idempotent: an
// embed URL passes through unchanged.
export function toEmbedUrl(url: string): string {
  const u = (url || '').trim()
  if (!u) return ''
  if (/(?:youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i.test(u)) return u
  // YouTube: watch?v=ID, youtu.be/ID, shorts/ID, live/ID
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  // Vimeo: vimeo.com/123456789 (optionally /video/)
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  return ''
}

// True when the URL maps to a supported embeddable video (for UI feedback).
export function isEmbeddableVideo(url: string): boolean {
  return toEmbedUrl(url) !== ''
}

// True when the value points at a direct video file (an uploaded .mp4/.webm/…)
// rather than a YouTube/Vimeo page — those render in a <video>, not an <iframe>.
export function isVideoFile(url: string): boolean {
  const u = (url || '').trim().split(/[?#]/)[0].toLowerCase()
  return /\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(u)
}

export type VideoKind = 'embed' | 'file' | 'none'

// Classify a stored video value: a trusted embed URL, a direct file, or neither.
export function classifyVideo(url: string): VideoKind {
  if (toEmbedUrl(url)) return 'embed'
  if (isVideoFile(url)) return 'file'
  return 'none'
}

// Render a stored video value into a [data-edit-video] wrapper: embeds populate
// the template <iframe>; uploaded files render in a <video> (created if the
// wrapper predates file support); empty clears both so the placeholder shows.
// Mirrored in the publish pipeline (scripts/inject-content.js applyVideoEl).
export function applyVideoTo(el: Element, value: string): void {
  const doc = el.ownerDocument
  const kind = classifyVideo(value)
  const iframe = el.querySelector('iframe')
  let video = el.querySelector('video') as HTMLVideoElement | null

  if (iframe) iframe.setAttribute('src', kind === 'embed' ? toEmbedUrl(value) : '')

  if (kind === 'file') {
    if (!video) {
      video = doc.createElement('video')
      video.setAttribute('controls', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('preload', 'metadata')
      video.setAttribute(
        'style',
        'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;object-fit:contain',
      )
      el.appendChild(video)
    }
    video.setAttribute('src', value)
    video.style.display = ''
  } else if (video) {
    video.removeAttribute('src')
    video.style.display = 'none'
  }
}
