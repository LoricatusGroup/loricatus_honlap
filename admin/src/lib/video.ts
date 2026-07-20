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
