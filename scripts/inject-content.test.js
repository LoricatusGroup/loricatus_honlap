// Local test for the catalog-section pipeline in inject-content.js.
// Run: node scripts/inject-content.test.js  (needs jsdom, same as publish).
// Verifies materialization, key-rewriting, content application, removal,
// idempotency, backward-compatibility, and graceful handling of bad input.

const assert = require('assert')
const { JSDOM } = require('jsdom')
const inj = require('./inject-content')

function makeDoc(bodyHtml) {
  return new JSDOM(
    `<!DOCTYPE html><html><head></head><body>${bodyHtml}</body></html>`,
  ).window.document
}

let passed = 0
function check(name, cond) {
  assert.ok(cond, name)
  console.log('  ✓', name)
  passed++
}

// 1. Insert a CTA section + apply content to it
{
  const doc = makeDoc('<section data-section="hero">hero</section><footer>foot</footer>')
  const layout = { added_sections: [{ id: 'asec-abc', template: 'cta' }] }
  const n = inj.materializeAddedSections(doc, layout)
  check('cta: exactly one section inserted', n === 1)
  const sec = doc.querySelector('[data-section="asec-abc"]')
  check('cta: section present with instance id', !!sec)
  check(
    'cta: inserted before <footer>',
    sec.nextElementSibling && sec.nextElementSibling.tagName === 'FOOTER',
  )
  check('cta: data-edit key rewritten to instance prefix', !!doc.querySelector('[data-edit="asec-abc-title"]'))
  check('cta: data-edit-href key rewritten', !!doc.querySelector('[data-edit-href="asec-abc-button-href"]'))
  check('cta: no leftover template-prefixed keys', !doc.querySelector('[data-edit="cta-title"]'))

  const { applied } = inj.applyContent(doc, {
    'asec-abc-title': 'Egyedi CTA cím',
    'asec-abc-button': 'Kérek ajánlatot',
  })
  check('cta: applyContent hit both keys', applied === 2)
  check('cta: title text applied', doc.querySelector('[data-edit="asec-abc-title"]').textContent === 'Egyedi CTA cím')

  const n2 = inj.materializeAddedSections(doc, layout)
  check(
    'cta: idempotent (no duplicate on re-run)',
    n2 === 0 && doc.querySelectorAll('[data-section="asec-abc"]').length === 1,
  )
}

// 2. Remove a stray added-section no longer in added_sections
{
  const doc = makeDoc(
    '<section data-section="hero">h</section><section data-section="asec-x">x</section><footer>f</footer>',
  )
  const removed = inj.removeStraySections(doc, { added_sections: [] })
  check('remove: stray asec-* removed', removed === 1 && !doc.querySelector('[data-section="asec-x"]'))
  check('remove: original section kept', !!doc.querySelector('[data-section="hero"]'))
}

// 3. FAQ template (4 Q/A pairs) rewrites all keys
{
  const doc = makeDoc('<section data-section="hero">h</section><footer>f</footer>')
  inj.materializeAddedSections(doc, { added_sections: [{ id: 'asec-f', template: 'faq' }] })
  check('faq: q1 key rewritten', !!doc.querySelector('[data-edit="asec-f-q1"]'))
  check('faq: a4 key rewritten', !!doc.querySelector('[data-edit-html="asec-f-a4"]'))
}

// 4. Backward-compat: no added_sections → strict no-op
{
  const doc = makeDoc('<section data-section="hero">h</section><footer>f</footer>')
  const before = doc.body.innerHTML
  const n = inj.materializeAddedSections(doc, {})
  const rm = inj.removeStraySections(doc, {})
  check('compat: no-op when added_sections absent', n === 0 && rm === 0 && doc.body.innerHTML === before)
}

// 5. Unknown template is skipped gracefully (no throw, no insert)
{
  const doc = makeDoc('<footer>f</footer>')
  const n = inj.materializeAddedSections(doc, { added_sections: [{ id: 'asec-z', template: 'nope' }] })
  check('unknown template: skipped without inserting', n === 0 && !doc.querySelector('[data-section="asec-z"]'))
}

// 6. Manifest loads + resolveTarget maps (page, locale) -> file/slug/url
{
  const manifest = inj.loadManifest()
  check('manifest: has pages array', Array.isArray(manifest.pages) && manifest.pages.length >= 2)
  const home = inj.resolveTarget(manifest, 'home', 'hu')
  check('resolve: home/hu -> index.html', home && home.filePath === 'index.html' && home.pageSlug === 'index')
  const ref = inj.resolveTarget(manifest, 'referenciak', 'en')
  check(
    'resolve: referenciak/en -> en/referenciak/index.html',
    ref && ref.filePath === 'en/referenciak/index.html' && ref.pageSlug === 'referenciak-en' && ref.url === '/en/referenciak/',
  )
  check('resolve: unknown page -> null', inj.resolveTarget(manifest, 'nope', 'hu') === null)
  check('resolve: unknown locale -> null', inj.resolveTarget(manifest, 'home', 'de') === null)
}

// 7. Sitemap includes every page x locale url + extraUrls
{
  const manifest = inj.loadManifest()
  const xml = inj.buildSitemapXml(manifest)
  const locs = (xml.match(/<loc>/g) || []).length
  check('sitemap: 12 pages (home+rolunk+ref+blog x3) + 3 extras = 15 urls', locs === 15)
  check('sitemap: contains referenciak hu', xml.includes('<loc>https://loricatus.hu/referenciak/</loc>'))
  check('sitemap: contains referenciak it', xml.includes('<loc>https://loricatus.hu/it/referenciak/</loc>'))
  check('sitemap: contains blog index', xml.includes('<loc>https://loricatus.hu/blog/</loc>'))
  check('sitemap: contains rolunk hu', xml.includes('<loc>https://loricatus.hu/rolunk/</loc>'))
  check('sitemap: contains rolunk en', xml.includes('<loc>https://loricatus.hu/en/rolunk/</loc>'))
  check('sitemap: contains extra /tudastar/', xml.includes('<loc>https://loricatus.hu/tudastar/</loc>'))
  // Blog post urls passed as extra are appended.
  const xml2 = inj.buildSitemapXml(manifest, ['https://loricatus.hu/blog/elso-cikk/'])
  check('sitemap: blog post url appended', xml2.includes('<loc>https://loricatus.hu/blog/elso-cikk/</loc>'))
}

// 8. applySeo regenerates canonical + hreflang cluster from the manifest
{
  const manifest = inj.loadManifest()
  const page = manifest.pages.find((p) => p.id === 'referenciak')
  const doc = new JSDOM('<!DOCTYPE html><html><head><link rel="canonical" href="http://old"><link rel="alternate" hreflang="hu" href="http://old"></head><body></body></html>').window.document
  inj.applySeo(doc, manifest, page, 'en')
  check('seo: canonical points to en referenciak', doc.querySelector('link[rel="canonical"]').getAttribute('href') === 'https://loricatus.hu/en/referenciak/')
  const alts = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'))
  check('seo: 4 alternates (hu/en/it/x-default)', alts.length === 4)
  check('seo: it alternate correct', alts.some((a) => a.getAttribute('hreflang') === 'it' && a.getAttribute('href') === 'https://loricatus.hu/it/referenciak/'))
  check('seo: x-default -> hu url', alts.some((a) => a.getAttribute('hreflang') === 'x-default' && a.getAttribute('href') === 'https://loricatus.hu/referenciak/'))
  check('seo: no leftover stale hreflang', !alts.some((a) => a.getAttribute('href') === 'http://old'))
}

// 9. Real referenciak page: adding a case-study clones the template card + rewrites keys
{
  const fs = require('fs')
  const path = require('path')
  const html = fs.readFileSync(path.join(__dirname, '..', 'referenciak', 'index.html'), 'utf-8')
  const doc = new JSDOM(html).window.document
  check('page: references list present', !!doc.querySelector('[data-list="references"]'))
  check('page: 3 authored cards', doc.querySelectorAll('[data-list-item^="ref-"]').length === 3)
  const layout = { list_order: { references: ['ref-1', 'ref-2', 'ref-3', 'ref-4'] } }
  const cloned = inj.materializeAddedItems(doc, layout)
  check('page: one new card cloned', cloned === 1)
  check('page: ref-4 card exists', !!doc.querySelector('[data-list-item="ref-4"]'))
  check('page: ref-4 title key rewritten', !!doc.querySelector('[data-edit="ref-4-title"]'))
  check('page: ref-4 benefit (html) key rewritten', !!doc.querySelector('[data-edit-html="ref-4-benefit"]'))
  const { applied } = inj.applyContent(doc, { 'ref-4-title': 'Új esettanulmány', 'ref-4-category': 'Teszt' })
  check('page: applyContent fills new card', applied === 2 && doc.querySelector('[data-edit="ref-4-title"]').textContent === 'Új esettanulmány')
}

// 10. mergeManifest folds dynamic (site_pages) rows into the page list
{
  const base = inj.loadManifest()
  const merged = inj.mergeManifest(base, [
    { page_id: 'szolgaltatasok', template: 'text', nav: { hu: 'Szolgáltatásaink', en: 'Services', it: 'Servizi' }, in_nav: true, sort_order: 50 },
  ])
  const dyn = merged.pages.find((p) => p.id === 'szolgaltatasok')
  check('merge: dynamic page added', !!dyn && dyn._dynamic === true)
  check('merge: dynamic hu url computed', dyn.locales.hu.url === '/szolgaltatasok/')
  check('merge: dynamic en slug computed', dyn.locales.en.slug === 'szolgaltatasok-en')
  check('merge: base pages retained', merged.pages.some((p) => p.id === 'home') && merged.pages.some((p) => p.id === 'referenciak'))
}

// 11. syncNav — additive on a hand-authored nav; strict no-op with no dynamic pages
{
  const base = inj.loadManifest()
  const navHtml =
    '<nav><ul class="nav-links">' +
    '<li data-list-item="nav-1"><a href="#services">Szolg</a></li>' +
    '<li data-list-item="nav-6"><a href="/referenciak/">Ref</a></li>' +
    '<li data-list-item="nav-5"><a href="#contact" class="nav-cta-link">Ajánlat</a></li>' +
    '</ul></nav>'

  // No dynamic pages → nav untouched
  const doc0 = makeDoc(navHtml)
  inj.syncNav(doc0, base, '/', 'hu')
  check('syncNav: strict no-op when no dynamic pages', doc0.querySelectorAll('li[data-navpage]').length === 0)

  // One dynamic page → its link injected before the CTA, base pages untouched
  const merged = inj.mergeManifest(base, [
    { page_id: 'szolgaltatasok', nav: { hu: 'Szolgáltatásaink' }, in_nav: true, sort_order: 50 },
  ])
  const doc1 = makeDoc(navHtml)
  inj.syncNav(doc1, merged, '/', 'hu')
  const injected = doc1.querySelector('li[data-navpage="szolgaltatasok"]')
  check('syncNav: dynamic link injected', !!injected)
  check('syncNav: referenciak (base) NOT duplicated', !doc1.querySelector('li[data-navpage="referenciak"]'))
  check(
    'syncNav: injected before the CTA item',
    injected && injected.nextElementSibling && injected.nextElementSibling.querySelector('.nav-cta-link'),
  )
  check('syncNav: label from manifest nav', injected.querySelector('a').textContent === 'Szolgáltatásaink')

  // Idempotent: running again does not duplicate
  inj.syncNav(doc1, merged, '/', 'hu')
  check('syncNav: idempotent', doc1.querySelectorAll('li[data-navpage="szolgaltatasok"]').length === 1)
}

// 12. syncNav — data-navauto builds the whole page-level menu with active state
{
  const base = inj.loadManifest()
  const merged = inj.mergeManifest(base, [
    { page_id: 'szolgaltatasok', nav: { hu: 'Szolgáltatásaink' }, in_nav: true, sort_order: 50 },
  ])
  const doc = makeDoc('<nav><ul class="nav-links" data-navauto></ul></nav>')
  inj.syncNav(doc, merged, '/szolgaltatasok/', 'hu')
  const links = Array.from(doc.querySelectorAll('ul.nav-links li[data-navpage]'))
  // home + rolunk + referenciak + dynamic(szolgaltatasok) + blog + cta
  check('navauto: 6 items incl. rolunk + blog + cta', links.length === 6)
  check('navauto: home link first', links[0].getAttribute('data-navpage') === 'home')
  check('navauto: last is cta (mobile)', links[links.length - 1].getAttribute('data-navpage') === 'cta')
  check('navauto: cta points to home #contact', doc.querySelector('[data-navpage="cta"] a').getAttribute('href') === '/#contact')
  const active = doc.querySelector('ul.nav-links a.active')
  check('navauto: current page marked active', active && active.getAttribute('href') === '/szolgaltatasok/')
}

// 13. syncLangSwitcher fills a data-langauto container for the page's locales
{
  const merged = inj.mergeManifest(inj.loadManifest(), [
    { page_id: 'szolgaltatasok', nav: { hu: 'X' }, in_nav: true },
  ])
  const page = merged.pages.find((p) => p.id === 'szolgaltatasok')
  const doc = makeDoc('<div class="lang-switcher" data-langauto></div>')
  inj.syncLangSwitcher(doc, page, 'en')
  const langs = Array.from(doc.querySelectorAll('.lang-switcher a'))
  check('lang: 3 links', langs.length === 3)
  check('lang: en active + correct href', langs.some((a) => a.classList.contains('is-active') && a.getAttribute('href') === '/en/szolgaltatasok/'))
}

// 14. scaffoldPageFile builds a page file from the base shell + body template
{
  const fs = require('fs')
  const path = require('path')
  const merged = inj.mergeManifest(inj.loadManifest(), [
    { page_id: 'tesztoldal', template: 'text', nav: { hu: 'Teszt oldal' }, in_nav: true },
  ])
  const page = merged.pages.find((p) => p.id === 'tesztoldal')
  const out = path.join(require('os').tmpdir(), `scaffold-${Date.now()}`, 'index.html')
  inj.scaffoldPageFile(out, page, 'hu', merged)
  const html = fs.readFileSync(out, 'utf-8')
  check('scaffold: file written', html.length > 200)
  check('scaffold: lang set', html.includes('<html lang="hu">'))
  check('scaffold: title has label', html.includes('Teszt oldal – Loricatus'))
  check('scaffold: nav auto marker present', html.includes('data-navauto'))
  check('scaffold: body template inserted (pg-hero)', html.includes('pg-hero'))
  check('scaffold: no leftover __BODY__ marker', !html.includes('__BODY__'))
  fs.rmSync(path.dirname(out), { recursive: true, force: true })
}

// 15. applyNavWidth flags a crowded nav (>5 visible items) as nav-wide
{
  const li = (h) => `<li>${h}</li>`
  const navHtml = (n) => {
    let items = ''
    for (let i = 0; i < n; i++) items += li(`<a href="#s${i}">Item ${i}</a>`)
    items += li('<a href="#contact" class="nav-cta-link">CTA</a>') // hidden on desktop
    return `<nav id="navbar" class="navbar"><ul class="nav-links">${items}</ul></nav>`
  }
  const d5 = makeDoc(navHtml(5))
  inj.applyNavWidth(d5)
  check('navwidth: 5 items -> not wide', !d5.querySelector('#navbar').classList.contains('nav-wide'))
  const d6 = makeDoc(navHtml(6))
  inj.applyNavWidth(d6)
  check('navwidth: 6 items -> nav-wide', d6.querySelector('#navbar').classList.contains('nav-wide'))
  // Removing back under threshold clears the class
  inj.applyNavWidth(d5)
  check('navwidth: cta-link not counted', !d5.querySelector('#navbar').classList.contains('nav-wide'))
}

// 16. removeDynamicPageFiles refuses reserved/invalid ids (path-safety)
{
  // Reserved / base ids must never be deletable.
  check('remove: refuses referenciak', inj.removeDynamicPageFiles('referenciak') === 0)
  check('remove: refuses assets', inj.removeDynamicPageFiles('assets') === 0)
  check('remove: refuses empty', inj.removeDynamicPageFiles('') === 0)
  check('remove: refuses traversal', inj.removeDynamicPageFiles('../secrets') === 0)
  // A non-existent (but validly-named) page is a clean no-op (0 dirs removed).
  check('remove: unknown valid id -> 0', inj.removeDynamicPageFiles('nincs-ilyen-oldal-xyz') === 0)
}

// 17. M4: a scaffolded page composes with catalog sections (added_sections)
{
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  const merged = inj.mergeManifest(inj.loadManifest(), [
    { page_id: 'komponalt', template: 'blank', nav: { hu: 'Komponált' }, in_nav: true },
  ])
  const page = merged.pages.find((p) => p.id === 'komponalt')
  const out = path.join(os.tmpdir(), `compose-${Date.now()}`, 'index.html')
  inj.scaffoldPageFile(out, page, 'hu', merged)
  const doc = new JSDOM(fs.readFileSync(out, 'utf-8')).window.document
  check('m4: blank template scaffolded (has footer)', !!doc.querySelector('footer'))
  // Compose: add a catalog CTA section to the scaffolded page.
  const n = inj.materializeAddedSections(doc, { added_sections: [{ id: 'asec-c1', template: 'cta' }] })
  check('m4: catalog section inserted into scaffolded page', n === 1)
  const sec = doc.querySelector('[data-section="asec-c1"]')
  check('m4: section present + before footer', sec && sec.nextElementSibling && sec.nextElementSibling.tagName === 'FOOTER')
  check('m4: section keys rewritten to instance', !!doc.querySelector('[data-edit="asec-c1-title"]'))
  fs.rmSync(path.dirname(out), { recursive: true, force: true })
}

// Video block: URL normalisation + end-to-end embed application
{
  check('video: youtube watch -> embed', inj.toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  check('video: youtu.be -> embed', inj.toEmbedUrl('https://youtu.be/dQw4w9WgXcQ') === 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  check('video: vimeo -> player', inj.toEmbedUrl('https://vimeo.com/123456789') === 'https://player.vimeo.com/video/123456789')
  check('video: unknown host -> empty (no arbitrary iframe)', inj.toEmbedUrl('https://evil.example/x') === '')

  const doc = makeDoc('<footer>foot</footer>')
  inj.materializeAddedSections(doc, { added_sections: [{ id: 'asec-vid', template: 'video' }] })
  const wrap = doc.querySelector('[data-edit-video="asec-vid-embed"]')
  check('video: section materialized with rewritten embed key on wrapper', !!wrap && wrap.tagName !== 'IFRAME')
  const { applied } = inj.applyContent(doc, { 'asec-vid-embed': 'https://youtu.be/dQw4w9WgXcQ' })
  const iframe = wrap.querySelector('iframe')
  check('video: applyContent set inner iframe src to embed url', applied === 1 && iframe.getAttribute('src') === 'https://www.youtube.com/embed/dQw4w9WgXcQ')

  // Uploaded file → renders in <video>, clears the iframe.
  check('video: isVideoFile detects mp4 (case + query)', inj.isVideoFile('https://x/clip.MP4?token=1') === true)
  check('video: isVideoFile rejects youtube', inj.isVideoFile('https://youtu.be/abc') === false)
  const mp4 = 'https://x.supabase.co/storage/v1/object/public/assets/site/clip.mp4'
  inj.applyContent(doc, { 'asec-vid-embed': mp4 })
  const vid = wrap.querySelector('video')
  check('video: mp4 -> <video> src set', !!vid && vid.getAttribute('src') === mp4)
  check('video: mp4 -> iframe src cleared', (wrap.querySelector('iframe').getAttribute('src') || '') === '')
  // Switch back to an embed → the <video> is cleared/hidden again.
  inj.applyContent(doc, { 'asec-vid-embed': 'https://youtu.be/dQw4w9WgXcQ' })
  check('video: switch back to embed clears <video>', (wrap.querySelector('video').getAttribute('src') || '') === '')
  check('video: switch back to embed restores iframe', wrap.querySelector('iframe').getAttribute('src') === 'https://www.youtube.com/embed/dQw4w9WgXcQ')
}

// Form placeholders are editable content too (data-edit-placeholder)
{
  const doc = makeDoc(
    '<form><input id="company" placeholder="Pl. Példa Kft." data-edit-placeholder="contact-company-ph">' +
    '<textarea placeholder="Írja le..." data-edit-placeholder="contact-message-ph"></textarea></form>',
  )
  const { applied, missing } = inj.applyContent(doc, {
    'contact-company-ph': 'Pl. Teszt Zrt.',
    'contact-message-ph': 'Új segédszöveg',
  })
  check('placeholder: both applied', applied === 2 && missing.length === 0)
  check('placeholder: input updated',
    doc.querySelector('#company').getAttribute('placeholder') === 'Pl. Teszt Zrt.')
  check('placeholder: textarea updated',
    doc.querySelector('textarea').getAttribute('placeholder') === 'Új segédszöveg')
  // the key must not leak into other attributes
  check('placeholder: value not written to textContent',
    (doc.querySelector('#company').textContent || '') === '')
}

// Background images (data-edit-bg): the Rólunk page holds its imagery in inline
// styles. The value is "url | position | size"; a one-part value must only swap
// the image and leave the framing alone, so older saved content stays valid.
{
  const base = 'height: 240px; background-image:url("/assets/rolunk/old.webp"); '
    + 'background-position:center; background-size:cover; border-radius: 8px'
  const doc = makeDoc(
    `<div id="a" style='${base}' data-edit-bg="rolunk-hatterkep-01"></div>` +
    `<div id="b" style='${base}' data-edit-bg="rolunk-hatterkep-02"></div>` +
    '<div id="c" style="height: 100px" data-edit-bg="rolunk-hatterkep-03"></div>',
  )
  const { applied, missing } = inj.applyContent(doc, {
    'rolunk-hatterkep-01': '/assets/rolunk/uj.webp | top left | contain',
    'rolunk-hatterkep-02': '/assets/rolunk/masik.jpg',
    'rolunk-hatterkep-03': '/assets/rolunk/harmadik.png | bottom | auto',
  })
  check('bg: all applied', applied === 3 && missing.length === 0)

  const sa = doc.querySelector('#a').getAttribute('style')
  check('bg: url swapped', sa.includes('url("/assets/rolunk/uj.webp")') && !sa.includes('old.webp'))
  check('bg: position set', /background-position:\s*top left/.test(sa))
  check('bg: size set', /background-size:\s*contain/.test(sa))
  check('bg: unrelated declarations kept', sa.includes('240px') && sa.includes('border-radius: 8px'))

  // one-part value: image only, framing untouched (backwards compatibility)
  const sb = doc.querySelector('#b').getAttribute('style')
  check('bg: url-only swaps image', sb.includes('url("/assets/rolunk/masik.jpg")'))
  check('bg: url-only keeps position', /background-position:\s*center/.test(sb))
  check('bg: url-only keeps size', /background-size:\s*cover/.test(sb))

  // element with no background yet: all three get added
  const sc = doc.querySelector('#c').getAttribute('style')
  check('bg: added to bare element', sc.includes('background-image:url("/assets/rolunk/harmadik.png")')
    && /background-position:\s*bottom/.test(sc) && /background-size:\s*auto/.test(sc))
  check('bg: bare element keeps its own style', sc.includes('height: 100px'))
  check('bg: value not written to textContent',
    (doc.querySelector('#a').textContent || '') === '')
}

// Uploaded full-HTML pages (M7): standalone verbatim vs shell-wrapped
{
  const manifest = inj.loadManifest()
  const page = { id: 'feltoltott', nav: { hu: 'Feltöltött' },
    locales: { hu: { slug: 'feltoltott', file: 'feltoltott/index.html', url: '/feltoltott/' } } }
  const uploaded =
    '<!DOCTYPE html><html><head><title>Szolgáltatásaink</title>' +
    '<meta name="description" content="Mit kínálunk">' +
    '<style>.hero{color:red}</style><link rel="stylesheet" href="https://cdn.example/x.css">' +
    '</head><body><h1>Ár: 100$ &amp; több</h1><p>Törzs $& $1 szöveg</p></body></html>'

  // standalone → byte-for-byte what was uploaded
  const standalone = inj.renderUploadedPage({ html: uploaded, mode: 'standalone' }, page, 'hu', manifest)
  check('upload: standalone is verbatim', standalone === uploaded)

  // shell → site chrome + uploaded body/styles, title/desc taken from upload
  const shell = inj.renderUploadedPage({ html: uploaded, mode: 'shell' }, page, 'hu', manifest)
  check('upload: shell keeps site nav', shell.includes('data-navauto'))
  check('upload: shell keeps site footer', shell.includes('class="footer"'))
  check('upload: shell has uploaded body', shell.includes('<h1>Ár: 100$ &amp; több</h1>'))
  check('upload: shell carries uploaded <style>', shell.includes('.hero{color:red}'))
  check('upload: shell carries uploaded stylesheet link', shell.includes('cdn.example/x.css'))
  check('upload: shell uses uploaded title', shell.includes('<title data-edit="page-title">Szolgáltatásaink</title>'))
  check('upload: shell uses uploaded description', shell.includes('content="Mit kínálunk"'))
  // `$&`/`$1` in uploaded HTML must survive. With string-form String.replace,
  // `$&` would expand to the matched placeholder — so the decisive checks are
  // that no `__BODY__` leaked and the literal text is intact ('&' is correctly
  // serialized to `&amp;`, which renders back as `$&`).
  check('upload: no placeholder leaked by $-patterns', !shell.includes('__BODY__'))
  check('upload: $-patterns preserved', shell.includes('Törzs $&amp; $1 szöveg'))
  check('upload: body wrapped for scoping', shell.includes('class="uploaded-page"'))
  // no <html> nesting: the shell is one document
  check('upload: shell has single <html>', (shell.match(/<html/gi) || []).length === 1)

  // title falls back to the nav label when the upload has none
  const noTitle = inj.renderUploadedPage({ html: '<html><body><p>x</p></body></html>', mode: 'shell' }, page, 'hu', manifest)
  check('upload: title falls back to page label', noTitle.includes('Feltöltött'))

  // findUpload matches on page + locale
  const ups = [{ page_id: 'a', locale: 'hu', html: '1' }, { page_id: 'a', locale: 'en', html: '2' }]
  check('upload: findUpload matches locale', inj.findUpload(ups, 'a', 'en').html === '2')
  check('upload: findUpload misses unknown page', inj.findUpload(ups, 'b', 'hu') === null)
}

// Case-study block: partial materializes with rewritten keys + editable content
{
  const doc = makeDoc('<footer>foot</footer>')
  inj.materializeAddedSections(doc, { added_sections: [{ id: 'cs1', template: 'casestudy' }] })
  check('casestudy: section materialized', !!doc.querySelector('[data-section="cs1"]'))
  check('casestudy: title key rewritten to instance id', !!doc.querySelector('[data-edit="cs1-title"]'))
  check('casestudy: has editable image', !!doc.querySelector('[data-edit-src="cs1-image"]'))
  const { applied } = inj.applyContent(doc, { 'cs1-title': 'Budai Vár felmérés', 'cs1-n1-num': '-42%' })
  check('casestudy: content applied', applied === 2 &&
    doc.querySelector('[data-edit="cs1-title"]').textContent === 'Budai Vár felmérés')
}

// Blog engine (M5): url/date helpers, card, post-page generation, cleanup
{
  const fs2 = require('fs')
  const path2 = require('path')
  const post = {
    slug: 'elso-cikk', title: 'Első cikk', excerpt: 'Rövid összefoglaló.',
    body: '<p>Ez a törzs.</p>', cover_url: 'https://cdn.example/c.jpg',
    tags: ['drón', 'hír'], published_at: '2026-03-15T10:00:00Z', author: 'Teszt',
  }
  check('blog: hu post url', inj.blogPostUrl('hu', 'elso-cikk') === '/blog/elso-cikk/')
  check('blog: en post url', inj.blogPostUrl('en', 'elso-cikk') === '/en/blog/elso-cikk/')
  check('blog: hu date', inj.formatPostDate('2026-03-15T10:00:00Z', 'hu') === '2026. március 15.')
  check('blog: en date', inj.formatPostDate('2026-03-15T10:00:00Z', 'en') === 'March 15, 2026')

  const card = inj.buildPostCard(post, 'hu')
  check('blog: card has title', card.includes('Első cikk'))
  check('blog: card links to post', card.includes('href="/blog/elso-cikk/"'))
  check('blog: card has cover', card.includes('c.jpg'))
  check('blog: card has tag', card.includes('>drón<'))

  const manifest = inj.loadManifest()
  const blogPage = manifest.pages.find((p) => p.id === 'blog')
  check('blog: manifest has blog page', !!blogPage)

  // Soro embed: renders the container + deferred script for the configured id.
  const soro = inj.soroEmbedHtml('abc-123')
  check('soro: has container', soro.includes('id="soro-blog"'))
  check('soro: has embed script', soro.includes('api/embed/abc-123') && soro.includes('defer'))
  check('soro: spans grid width', soro.includes('grid-column:1/-1'))

  // Post page round-trip (writes under repo blog/<slug>, cleaned up after).
  const blogRoot = path2.join(__dirname, '..', 'blog')
  const testSlug = 'zzz-teszt-cikk'
  inj.generateBlogPost({ ...post, slug: testSlug }, 'hu', manifest, blogPage)
  const f = path2.join(blogRoot, testSlug, 'index.html')
  const html = fs2.readFileSync(f, 'utf-8')
  check('blog: post page has title', html.includes('Első cikk'))
  check('blog: post canonical', html.includes(`rel="canonical" href="https://loricatus.hu/blog/${testSlug}/"`))
  check('blog: post og:type article', html.includes('content="article"'))
  check('blog: post body injected', html.includes('<p>Ez a törzs.</p>'))
  check('blog: post nav present', html.includes('data-navauto'))
  fs2.rmSync(path2.join(blogRoot, testSlug), { recursive: true, force: true })

  // Stale cleanup: keep all pre-existing dirs, drop a throwaway one.
  const existing = fs2.existsSync(blogRoot)
    ? fs2.readdirSync(blogRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : []
  fs2.mkdirSync(path2.join(blogRoot, 'zzz-drop'), { recursive: true })
  const removed = inj.removeStaleBlogPosts('hu', new Set(existing))
  check('blog: stale post dir removed', removed === 1 && !fs2.existsSync(path2.join(blogRoot, 'zzz-drop')))

  // RSS round-trip — back up/restore the committed blog/rss.xml so the test
  // never clobbers a real file.
  const rssPath = path2.join(blogRoot, 'rss.xml')
  const rssBackup = fs2.existsSync(rssPath) ? fs2.readFileSync(rssPath, 'utf-8') : null
  inj.writeBlogRss('hu', manifest, [post])
  const rss = fs2.readFileSync(rssPath, 'utf-8')
  check('blog: rss has item title', rss.includes('<title>Első cikk</title>'))
  check('blog: rss has post link', rss.includes('<link>https://loricatus.hu/blog/elso-cikk/</link>'))
  if (rssBackup !== null) fs2.writeFileSync(rssPath, rssBackup)
  else {
    fs2.rmSync(rssPath, { force: true })
    try { fs2.rmdirSync(blogRoot) } catch { /* not empty or gone — fine */ }
  }
}

// AI-compare links: the three hrefs are derived from one CMS field, so editing
// the question in the editor must move all three at publish time.
{
  const doc = new JSDOM(
    '<!DOCTYPE html><html><head>' +
      '<meta name="ai-compare-prompt" data-edit-content="footer-ai-prompt" content="Eredeti kérdés">' +
      '</head><body><div class="ai-compare-band">' +
      '<a data-ai-service="chatgpt" href="https://chatgpt.com/?hints=search&q=elavult"></a>' +
      '<a data-ai-service="claude" href="https://claude.ai/new?q=elavult"></a>' +
      '<a data-ai-service="perplexity" href="https://www.perplexity.ai/search?q=elavult"></a>' +
      '<a data-ai-service="ismeretlen" href="https://example.com/?q=x"></a>' +
      '</div></body></html>',
  ).window.document

  inj.applyContent(doc, { 'footer-ai-prompt': 'Foglald össze a Loricatus & társai oldalt' })
  const href = (s) => doc.querySelector(`[data-ai-service="${s}"]`).getAttribute('href')
  const q = encodeURIComponent('Foglald össze a Loricatus & társai oldalt')

  check('ai: meta content updated from the CMS field',
    doc.querySelector('meta[name="ai-compare-prompt"]').getAttribute('content') ===
      'Foglald össze a Loricatus & társai oldalt')
  check('ai: chatgpt href rebuilt', href('chatgpt') === `https://chatgpt.com/?hints=search&q=${q}`)
  check('ai: claude href rebuilt', href('claude') === `https://claude.ai/new?q=${q}`)
  check('ai: perplexity href rebuilt', href('perplexity') === `https://www.perplexity.ai/search?q=${q}`)
  check('ai: ampersand in the question is encoded, not left raw',
    href('claude').includes('%26') && !href('claude').includes('társai'))
  check('ai: unknown service left alone', href('ismeretlen') === 'https://example.com/?q=x')

  // A page without the band must not blow up.
  const bare = makeDoc('<p data-edit="x">a</p>')
  const { applied } = inj.applyContent(bare, { x: 'b' })
  check('ai: page without the band still applies content', applied === 1)
}

// Generated pages (blog posts, editor-created pages) come from one shared
// template, so an English post must not end up asking the question in Hungarian.
{
  const base = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'page-templates', '_base.html'), 'utf-8')
  check('base: template still carries the placeholders',
    base.includes('__AI_PROMPT__') && base.includes('__AI_Q__') && base.includes('__AI_LEAD__'))

  for (const [loc, needle, lead] of [
    ['hu', 'https://loricatus.hu oldalt', 'Hasonlíts össze minket'],
    ['en', 'https://loricatus.hu/en/', 'Compare us using'],
    ['it', 'https://loricatus.hu/it/', 'Confrontaci con'],
  ]) {
    const html = inj.fillAiCompare(base, loc)
    check(`base/${loc}: no placeholder left behind`, !/__AI_[A-Z]+__/.test(html))
    check(`base/${loc}: the question points at this locale`, html.includes(needle))
    check(`base/${loc}: the lead is in this language`, html.includes(lead))

    const doc = new JSDOM(html).window.document
    const prompt = doc.querySelector('meta[name="ai-compare-prompt"]').getAttribute('content')
    const href = doc.querySelector('[data-ai-service="claude"]').getAttribute('href')
    check(`base/${loc}: the baked link carries the whole question`,
      new URL(href).searchParams.get('q') === prompt)
    check(`base/${loc}: the question is editable from the CMS`,
      doc.querySelector('meta[data-edit-content="footer-ai-prompt"]') !== null)
  }

  // An unknown locale must still produce a usable page, not placeholders.
  check('base: unknown locale falls back to Hungarian',
    !/__AI_[A-Z]+__/.test(inj.fillAiCompare(base, 'de')))
}

// Stat counters: the number must survive into the text, not just the attribute.
// A reader without JavaScript -- every AI crawler -- otherwise sees "0 projects".
{
  const doc = makeDoc('<span class="stat-num" data-target="500" data-edit-target="hero-stat-1-num">500</span>')
  inj.applyContent(doc, { 'hero-stat-1-num': '640' })
  const el = doc.querySelector('.stat-num')
  check('stat: data-target updated', el.getAttribute('data-target') === '640')
  check('stat: the number is readable without JavaScript', el.textContent === '640')
}

console.log(`\n${passed} checks passed`)
