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
  check('sitemap: 6 pages + 3 extras = 9 urls', locs === 9)
  check('sitemap: contains referenciak hu', xml.includes('<loc>https://loricatus.hu/referenciak/</loc>'))
  check('sitemap: contains referenciak it', xml.includes('<loc>https://loricatus.hu/it/referenciak/</loc>'))
  check('sitemap: contains extra /tudastar/', xml.includes('<loc>https://loricatus.hu/tudastar/</loc>'))
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
  check('navauto: home + referenciak + dynamic present', links.length === 3)
  check('navauto: home link first', links[0].getAttribute('data-navpage') === 'home')
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

console.log(`\n${passed} checks passed`)
