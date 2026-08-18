import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Copies ui-2.html's <style> block into app/globals.css.
 *
 * Same principle as the data extraction: taking the stylesheet verbatim means the
 * app's design tokens, spacing and dark-mode palette cannot drift from the prototype.
 * Re-run whenever ui-2.html's styling changes.
 */
const html = readFileSync('ui-2.html', 'utf8')
const start = html.indexOf('<style>')
const end = html.indexOf('</style>')
if (start < 0 || end < 0) throw new Error('ui-2.html: no <style> block found')

const css = html.slice(start + '<style>'.length, end).trim()
const header = `/*
 * Design system ported verbatim from ui-2.html <style>.
 * Extracted, not retyped, so the app cannot drift from the prototype.
 * Regenerate with: node db/tools/extract-css.mjs
 */

`

writeFileSync('app/globals.css', `${header}${css}\n`)
console.log(`globals.css: ${(css.length / 1024).toFixed(1)} KB, ${css.split('\n').length} lines`)
