# CLAUDE.md

## Project

**VLX** is a prototype of a Vietnamese maritime trading and maritime-finance exchange, built for the **VMFB** programme. It matches cargo owners with carriers, carries the resulting shipment through documents and settlement, and lets banks, insurers and a regulator work on the same transaction record.

`ui-2.html` is a complete, self-contained HTML prototype of the product (4,958 lines). It is the **source of truth** for this repo: every table, column and seed row traces to a line in it. This codebase turns that prototype into a real Next.js app on Postgres.

`ui.html` is the superseded first version. Ignore it.

### Personas

The prototype has no login. A persona is a *view*, selected by URL (`/shipper`, `/carrier`, …).

| Persona | Code | What they do |
|---|---|---|
| Shipper / BCO | `shipper` | Search rates, book, run tenders, track shipments, documents, wallet, L/C, consent |
| Carrier / provider | `carrier` | Publish capacity and rates, bid on tenders, manage fleet and product catalogue, reconcile |
| Platform operations | `exchange` | Ops console, VLX index, corridors, member KYB, AML, disputes, campaigns, clearing |
| Financial institution | `finance` | Credit decisions, financing and insurance products, asset finance, portfolio risk |
| Regulator / supervisor | `regulator` | Sandbox supervision, licence matrix, AI agent governance, neutrality |
| CDP member | `cdp` | Unified customer view, next-best-action, data boundaries |

## Stack and commands

Next.js 15 (App Router) · React 19 · Postgres 17 · Drizzle ORM · **pnpm**

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm build
pnpm typecheck

pnpm db:generate         # drizzle-kit: schema/*.ts -> db/migrations/
pnpm db:schema           # migration      -> db/out/schema.sql
pnpm db:seed             # ui-2.html      -> db/out/seed.sql
pnpm db:all              # all three, in order
pnpm db:verify           # import both into a throwaway Postgres 17 container and assert
```

This project **never migrates a live database**. It emits two portable files that get imported by hand:

```
db/out/schema.sql   DDL — 69 tables, 8 enums, 66 indexes, 21 CHECK constraints
db/out/seed.sql     every row of the prototype's dataset
```

Apply order is `schema.sql` then `seed.sql`. Set `DATABASE_URL` in `.env` (see `.env.example`) to point the app at wherever you imported them.

## Layout

```
app/
  [persona]/page.tsx     persona home (6 personas)
  r/[route]/page.tsx     dispatcher for the other 32 routes
  globals.css            extracted verbatim from ui-2.html <style>
  app-additions.css      only what React needs on top (the prototype inlines it in JS)
components/
  app-shell.tsx          topbar + DB-driven sidebar
  shell/                 ticker, theme toggle, notification bell, persona selector
  home-view.tsx          persona home layout
  charts.tsx             SVG chart kit ported from ui-2.html:400-465
  ui.tsx                 page header, KPI tile, card, tag, meter, boundary note
  table/                 URL-driven data table (search, filter, sort, paginate)
  pages/                 one module per persona group; registry.ts maps route -> page
lib/
  db.ts                  pooled drizzle client
  i18n.ts                vi/en helpers
  queries/               one module per page group
db/
  schema/                drizzle tables, split by domain
  tools/                 extraction + SQL emitters + verifier
  migrations/            drizzle-kit output (regenerate freely)
  out/                   schema.sql + seed.sql — the deliverables
```

## How the data gets in

The seed does **not** re-implement the prototype's generators. `db/tools/prototype-data.ts` executes `ui-2.html`'s own script in a Node VM with a stub DOM and reads the resulting arrays.

This matters. All 23 generators draw from one shared LCG whose output depends on **float64 precision loss** (`ui-2.html:653`) — `987654321 * 1103515245` exceeds `MAX_SAFE_INTEGER`, and a "correct" BigInt implementation diverges from the prototype on the *first* draw. Draw order is equally load-bearing: `OFFERS` assigns departure dates in a second pass after its main loop, and several generators rely on eager argument evaluation consuming extra draws. Executing the original source removes that whole class of bug.

Bilingual labels are recovered by running the script **twice**, once with `LANG='vi'` and once with `'en'`. The PRNG reseeds identically, so row *N* is the same row in both passes and labels pair by index.

Four modifications are applied to the extracted script. Every one asserts first, because a silent no-op here produces plausible-looking wrong data rather than an error:
- `dstr` and `dshort` are rewritten to return ISO dates (they render `dd/mm` with no year). Neither calls the PRNG, so the stream is untouched.
- `var LANG='vi'` is rewritten so the language can be injected. If this ever misses, *both* passes run Vietnamese and every `*_en` column silently fills with Vietnamese.
- Everything after `PERSONA='shipper';ROUTE='s_home';` is cut, so page functions stay defined but never run.
- The extractor also asserts there is exactly one `<script>` block, since it slices first-to-last.

**Not every label comes from the two passes.** Where the prototype stores a whole `[vi, en, weight]` tuple on the row (`rfqs.scope`, `disputes.iss`, `lc.ty`, …) both languages are already present and are read from one pass. Only fields that `L()` collapsed before they reached the row (`settlements.trig`, `disputes.src`, `assets.coll`) need the second pass. Reading `[0]` from the English pass returns Vietnamese — that mistake put Vietnamese into 76 `name_en` cells before `db:verify` grew an assertion for it.

`app/globals.css` is extracted the same way (`node db/tools/extract-css.mjs`) so the design system cannot drift either.

## Database conventions

- `snake_case`, plural table names; Drizzle field names are camelCase.
- **Bilingual**: `*_vi` / `*_en` column pairs on reference tables **only**. Transaction tables carry FKs, never labels.
- **Primary keys**: the prototype's business reference where it exposes one (`MB-1000`, `VLX-2026-80000`, `SP-2000`); `bigserial` otherwise.
- **Money — four scales are in play. Check the column before aggregating.** Only the `_m_vnd` columns are normalised; the rest carry the prototype's own unit.

  | Unit | Columns |
  |---|---|
  | Million VND (`_m_vnd` suffix) | `members.credit_limit_m_vnd`, `members.gmv_m_vnd`, `corridors.gmv_m_vnd` (×1000 at seed time, source renders `tỷ`) |
  | Million VND (unsuffixed) | `finance_applications.amount`, `aml_alerts.value`, `abuse_flags.amount` |
  | Billion VND | `asset_finance_deals.amount`, `campaigns.budget`, `campaigns.used`, `fleet_assets.opex`, `fleet_assets.revenue`, `fleet_assets.asset_value` |
  | USD | `lanes.index_price`, `offers.*` price columns, `rate_cards.*`, `shipments.value`, `shipments.cargo_value`, `letters_of_credit.amount`, `settlements.amount`, `disputes.value`, `products.price`/`cost` |
  | USD thousands | `rfqs.value`, `voyages.value` |

  `SELECT sum(amount)` across `finance_applications` and `asset_finance_deals` is a silent 1000× error.
- **Dates**: all relative offsets resolve against the anchor **2026-08-15** (`ui-2.html:662`).
- **Status codes**: `status_labels` is a shared dictionary (47 codes) — but it is **not** universal. `product_statuses` and `fleet_statuses` are separate tables because the code `live` means "Đang mở / Open" in the shared dictionary and "Đang niêm yết / Listed" for a product. Check for a collision before adding a code.
- `weight` columns carry the prototype's `pickw()` distribution where the source exposes it. Tables recovered from `L()`-collapsed fields (`evidence_sources`, `settlement_triggers`, `collateral_types`) have no weight in the source and store 0. Nothing reads these — the seed takes its rows from the prototype directly.

### Denormalised on purpose

Do not "fix" these:
- `corridor_id` sits alongside `lane_code` on most tables — the UI filters by corridor everywhere. `db:verify` asserts the two agree.
- `shipments.doc_count`, `rfqs.bid_count` and `members.teu` are independent prototype values, **not** aggregates. A query asserting they equal a `count(*)` will fail against correct data.
- `products.industry_code` duplicates what `group_code` implies, mirroring the prototype.

### products.cost means two different things

| `source` | id prefix | `cost` is |
|---|---|---|
| `in` (103 rows) | `SP-` | true cost of delivery |
| `out` (36 rows) | `LK-` | the partner's take — the residual is platform commission |

Never average or sum `margin_pct` across both without grouping by `source`.

## Constraints

- **All 38 prototype routes are ported.** 6 persona homes plus 32 detail pages.
- **No authentication.** Accepted for this demo build. Every query returns the full dataset; the prototype's "data boundary" notices are presentational. All data is synthetic (PRNG-generated), so no real records are exposed — but do not put this behind a public URL as-is. `member_id` FKs are retained on scoped tables so row-level scoping can be added later without a migration.
- Seed company names are kept verbatim from `ui-2.html` (real Vietnamese and FDI names against synthetic compliance data). This was a deliberate decision for demo credibility.
- `ui-2.html` is **read-only**. Change the prototype first, then regenerate.

## Known gaps

- `licence_matrix` and `decision_rights` are created but unseeded — both are literal arrays inside `pageRLicense()` rather than exported data, so they cannot be read without executing a page function.
- `modules` holds the 12 F-codes actually referenced (F02, F04–F06, F08–F15 — there is no F03 or F07) plus `SB`. `name_vi`/`name_en` are NULL: the prototype cites these as badges but never titles them.
- Voyage and asset-finance statuses (`draft`, `quoted`, `won`, `lost`, `pipeline`, `diligence`, `declined`) have no bilingual label in the source — `stTag()` renders the raw code, so the code is stored as its own label.
- Modals are not ported. The prototype opens a detail dialog from several tables; the ported pages show the same data inline instead.
- The prototype hardcodes two figures on the shipper home ("Chi cước tháng này 13.4 tỷ", "Hạn mức khả dụng 24.8 tỷ") with no data behind them. The app shows the real equivalents from `shipments.value` (USD) and `members.credit_limit_m_vnd`, so those two tiles read differently on purpose.
- `licence_matrix` and `decision_rights` are extracted by slicing their array literals out of `pageRLicense()` and evaluating them in the loaded context (`evalArrayLiteral`). They are the only data not reachable from a global, and the extraction asserts on both the marker and the licence flag values.

## Working here

- Docs live in `docs/`, plans in `plans/`. Do not create markdown elsewhere without being asked.
- YAGNI, KISS, DRY. Modularise code files over 200 LOC.
- After changing `db/schema/*.ts`: delete `db/migrations/` first, then `pnpm db:all && pnpm db:verify`. `emit-schema.ts` concatenates every migration file, so leaving an old one behind turns `schema.sql` into CREATE-then-ALTER instead of a clean snapshot.
- The verifier asserts 40 row counts and 13 consistency invariants against a real Postgres 17 container, including that every bilingual lookup actually recovered its English labels.
- `node db/tools/extract-css.mjs` re-syncs `app/globals.css` from the prototype. It is deliberately not in `db:all`, since restyling is rarer than reseeding.
