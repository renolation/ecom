import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'

/**
 * Loads ui-2.html's data engine by EXECUTING it, rather than re-typing it.
 *
 * Why: every collection draws from one shared LCG whose output depends on float64
 * precision loss (ui-2.html:653). A hand-port has to reproduce the exact draw order
 * — including eager argument evaluation and the second-pass depN loop — or every
 * downstream row silently changes. Running the original source removes that entire
 * class of bug: the seed cannot drift from the prototype because it IS the prototype.
 *
 * The script is evaluated with a stub DOM. Page functions are only *defined* at parse
 * time, never called (the trailing boot()/render() lines are stripped), so no rendering
 * happens and no browser API is touched beyond the stubs below.
 */

const PROTOTYPE = join(process.cwd(), 'ui-2.html')

export type Lang = 'vi' | 'en'

/** Anything the prototype's script touches at parse time. */
function makeSandbox(lang: Lang) {
  const noop = () => {}
  const anyElement = new Proxy({}, { get: () => noop })
  return {
    document: new Proxy(
      {},
      { get: (_t, key) => (key === 'getElementById' ? () => null : () => anyElement) },
    ),
    window: {},
    setTimeout: noop,
    clearTimeout: noop,
    console,
    __LANG__: lang,
  }
}

/** The prototype's last statement before it starts rendering. */
const BOOTSTRAP_MARKER = "PERSONA='shipper';ROUTE='s_home';"

function extractScript(html: string): string {
  const blocks = html.match(/<script>/g)?.length ?? 0
  if (blocks !== 1) {
    throw new Error(
      `ui-2.html: expected exactly one <script> block, found ${blocks}. ` +
        'Slicing from the first to the last would splice intervening HTML into the source.',
    )
  }
  const start = html.indexOf('<script>')
  const end = html.lastIndexOf('</script>')
  if (start < 0 || end < 0) throw new Error('ui-2.html: no <script> block found')
  const script = html.slice(start + '<script>'.length, end)

  // Everything after the marker is boot()/render() — page functions must stay
  // defined (they close over the data) but must never execute here.
  const cut = script.lastIndexOf(BOOTSTRAP_MARKER)
  if (cut < 0) {
    throw new Error(
      `ui-2.html: bootstrap marker "${BOOTSTRAP_MARKER}" not found — ` +
        'the prototype changed shape; update BOOTSTRAP_MARKER before seeding.',
    )
  }
  return toIsoDates(script.slice(0, cut))
}

/**
 * The prototype formats dates for display: `dstr` → dd/mm/yyyy, `dshort` → dd/mm
 * (no year at all). Parsing those back is lossy, so both are rewritten to emit
 * ISO yyyy-mm-dd before the data engine runs.
 *
 * Safe with respect to determinism: neither helper calls R(), so the PRNG stream is
 * untouched — only the rendered form of already-decided dates changes. Verified by
 * the row-count and cross-language identity checks in `verify.ts`.
 */
function toIsoDates(script: string): string {
  const iso = "return base.getFullYear()+'-'+d2(base.getMonth()+1)+'-'+d2(base.getDate())}"
  const dstrOriginal =
    "return d2(base.getDate())+'/'+d2(base.getMonth()+1)+'/'+base.getFullYear()}"
  const dshortOriginal = "return d2(base.getDate())+'/'+d2(base.getMonth()+1)}"

  for (const [name, original] of [['dstr', dstrOriginal], ['dshort', dshortOriginal]] as const) {
    if (!script.includes(original)) {
      throw new Error(
        `ui-2.html: ${name}() no longer matches its expected body — ` +
          'date extraction would silently produce wrong values. Update toIsoDates().',
      )
    }
  }
  return script.replace(dstrOriginal, iso).replace(dshortOriginal, iso)
}

/**
 * Evaluates the prototype in the requested language and returns its globals.
 *
 * `LANG` is overwritten before the data engine runs, so every `L(vi,en)` call made
 * during generation resolves in that language. The PRNG is reseeded identically on
 * each run, so row N in the 'vi' pass and row N in the 'en' pass are the same row —
 * which is how bilingual labels are recovered without transcribing any of them.
 */
export function loadPrototype(lang: Lang): Record<string, any> {
  const html = readFileSync(PROTOTYPE, 'utf8')
  const extracted = extractScript(html)

  // Guarded like the other rewrites: a silent no-op here would run BOTH passes in
  // Vietnamese and fill every *_en column with Vietnamese without failing anything.
  const langDecl = "var LANG='vi'"
  if (!extracted.includes(langDecl)) {
    throw new Error(
      `ui-2.html: could not find "${langDecl}" — the language switch cannot be set, ` +
        'so the English pass would silently return Vietnamese. Update loadPrototype().',
    )
  }
  const script = extracted.replace(langDecl, 'var LANG=__LANG__')
  const ctx = createContext(makeSandbox(lang))
  runInContext(script, ctx, { filename: 'ui-2.html' })
  return ctx as Record<string, any>
}

/** Both language passes, for zipping bilingual values by index. */
export function loadBilingual() {
  return { vi: loadPrototype('vi'), en: loadPrototype('en') }
}

/**
 * Evaluates an array literal lifted out of a page function body.
 *
 * The licence and decision-rights matrices (ui-2.html:4556/4583) are declared inline
 * inside `pageRLicense()` rather than as exported data, so they cannot be reached by
 * reading a global. Slicing the literal and evaluating it in the already-loaded
 * context gives the real rows with `L()` resolved, instead of re-typing them here.
 */
export function evalArrayLiteral(ctx: Record<string, any>, startMarker: string, endMarker: string): any[] {
  const html = readFileSync(PROTOTYPE, 'utf8')
  const start = html.indexOf(startMarker)
  if (start < 0) throw new Error(`ui-2.html: marker not found: ${startMarker}`)
  const from = html.indexOf('[', start)
  const end = html.indexOf(endMarker, from)
  if (from < 0 || end < 0) throw new Error(`ui-2.html: could not bound array after ${startMarker}`)

  const literal = html.slice(from, end)
  const result = runInContext(`(${literal})`, ctx as any, { filename: 'ui-2.html:matrix' })
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`ui-2.html: expression after ${startMarker} did not yield a non-empty array`)
  }
  return result
}
