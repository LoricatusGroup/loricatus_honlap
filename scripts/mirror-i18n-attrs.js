// One-shot script: copy structural data-* attributes from the Hungarian
// index.html (the CMS source-of-truth) onto en/index.html and it/index.html.
//
// Strategy: parallel-walk the two DOM trees. At each level, iterate the
// element children in lockstep. When the HU element has any data-* attribute
// (data-section, data-list, data-list-item, data-edit*), copy them to the
// position-matched EN/IT element. Skip subtrees where child counts diverge.
//
// Run locally: `node scripts/mirror-i18n-attrs.js`
// Writes back en/index.html and it/index.html.

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const COPY_ATTRS = [
  'data-section',
  'data-list',
  'data-list-item',
  'data-edit',
  'data-edit-html',
  'data-edit-src',
  'data-edit-href',
  'data-edit-color',
  'data-edit-target',
  'data-edit-content',
]

function hasAnyAttr(el) {
  return COPY_ATTRS.some((a) => el.hasAttribute(a))
}

function copyAttrs(from, to) {
  for (const attr of COPY_ATTRS) {
    if (from.hasAttribute(attr)) {
      to.setAttribute(attr, from.getAttribute(attr))
    }
  }
}

function walk(huEl, otherEl, stats, path = '') {
  if (huEl.nodeType !== 1 || otherEl.nodeType !== 1) return

  if (hasAnyAttr(huEl)) {
    copyAttrs(huEl, otherEl)
    stats.copied++
  }

  const huKids = Array.from(huEl.children)
  const otherKids = Array.from(otherEl.children)
  if (huKids.length !== otherKids.length) {
    stats.mismatched++
    stats.mismatchedPaths.push(
      `${path || huEl.tagName.toLowerCase()}: HU=${huKids.length}, other=${otherKids.length}`,
    )
    // Walk as far as we can in lockstep, then stop at this level
    const limit = Math.min(huKids.length, otherKids.length)
    for (let i = 0; i < limit; i++) {
      walk(
        huKids[i],
        otherKids[i],
        stats,
        `${path}>${huKids[i].tagName.toLowerCase()}[${i}]`,
      )
    }
    return
  }

  for (let i = 0; i < huKids.length; i++) {
    walk(huKids[i], otherKids[i], stats, `${path}>${huKids[i].tagName.toLowerCase()}[${i}]`)
  }
}

function mirrorFile(huHtml, targetPath) {
  const targetHtml = fs.readFileSync(targetPath, 'utf-8')
  const huDom = new JSDOM(huHtml)
  const otherDom = new JSDOM(targetHtml)

  const stats = { copied: 0, mismatched: 0, mismatchedPaths: [] }

  // Walk <head> and <body> in parallel
  walk(huDom.window.document.head, otherDom.window.document.head, stats, 'head')
  walk(huDom.window.document.body, otherDom.window.document.body, stats, 'body')

  // Set the html lang attribute on the target stays as-is (don't copy that)

  const out = otherDom.serialize()
  fs.writeFileSync(targetPath, out)

  console.log(`${targetPath}:`)
  console.log(`  copied attrs on ${stats.copied} elements`)
  if (stats.mismatched) {
    console.log(`  ${stats.mismatched} subtree count mismatch(es):`)
    stats.mismatchedPaths.forEach((p) => console.log(`    - ${p}`))
  }
}

const huPath = path.join(__dirname, '..', 'index.html')
const huHtml = fs.readFileSync(huPath, 'utf-8')

mirrorFile(huHtml, path.join(__dirname, '..', 'en', 'index.html'))
mirrorFile(huHtml, path.join(__dirname, '..', 'it', 'index.html'))

console.log('\nDone. Inspect git diff to verify.')
