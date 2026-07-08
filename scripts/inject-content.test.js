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

console.log(`\n${passed} checks passed`)
