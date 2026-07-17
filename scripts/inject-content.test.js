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

console.log(`\n${passed} checks passed`)
