---
phase: 6
title: "Deterministic Seed Port"
status: pending
priority: P1
effort: "10h"
dependencies: [5]
---

# Phase 6: Deterministic Seed Port

## Overview

Port `ui-2.html`'s mock-data engine to a TypeScript seed that reproduces the prototype's dataset exactly. This is the highest-risk phase: all 23 generators draw from one shared PRNG stream, so any deviation in draw order silently changes every downstream row.

## Requirements

**Functional**
- Static reference data seeded verbatim from `ui-2.html` (lanes, corridors, carriers, AI agents, sandbox programmes, campaigns, consent purposes, licence matrix, decision rights, all label tables).
- Generated data reproduced with exact row counts and identical values.
- Seed is idempotent: truncate-and-reload, safe to re-run.
- A checksum command proves determinism across runs.

**Non-functional**
- Seed modules under 200 LOC each.
- Seed runs in under 30 seconds on a local Postgres.
- Batch inserts, not row-by-row.

## Architecture

### The PRNG contract (non-negotiable)

`ui-2.html` line 652:

```js
var _s = 987654321;
function R(){ _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff }
```

`987654321 * 1103515245 ≈ 1.09e18` exceeds `Number.MAX_SAFE_INTEGER`, so **the multiply loses precision — and the generator depends on that loss**. Verified divergence:

```
float64 (correct): 0.4882413747  0.9923939710  0.4812512400  0.7686467174
BigInt   (wrong):  0.4882413850  0.2974091877  0.4498034736  0.1816366823
```

The streams split at the **second** draw. Port `R()` verbatim in plain `number` arithmetic. Do **not** "fix" it with BigInt, `Math.imul`, or a textbook LCG — any of those produce a completely different dataset.

Helpers to port verbatim: `ri(a,b)`, `pick(a)`, `pickw(a)`, `d2(x)`, `dstr(offset)`, `dshort(offset)` (lines 652–663). Date anchor: `new Date(2026, 7, 15)` = **2026-08-15**.

`rnd(seed)` and `walk()` (lines 465–466) drive sparkline rendering only and touch no stored data — do not port them.

### Draw-order trap: eager argument evaluation

The most likely porting bug. JavaScript evaluates every array/object literal element **before** the selecting call runs:

```js
// lines 719–720 — SEVEN ri() draws happen, then one value is indexed
var sc = {AAA:ri(88,96), AA:ri(80,88), A:ri(72,80), BBB:ri(62,72),
          BB:ri(50,62),  B:ri(38,50),  CCC:ri(24,38)}[rate];

// line 750 — FOUR ri() draws, then pickw() draws a fifth
qty: pickw([[ri(1,4),34],[ri(5,14),38],[ri(15,40),22],[ri(41,90),6]])
```

A "cleaner" port that computes only the selected branch consumes fewer draws and desynchronises everything after it. **Preserve eager evaluation exactly.** Audit every generator for this pattern before writing it; `members.score`, `members.credit_limit`, and `shipments.qty` are known instances.

### Generator execution order

All generators are IIFEs executing at parse time, so file order is draw order. Seed in exactly this sequence:

| # | Collection | Line | Rows |
|---|---|---|---|
| 1 | `MEMBERS` | 709 | 128 |
| 2 | `SHIPS` | 745 | 146 |
| 3 | **`OFFERS`** | **767** | **320** — plus a second pass at 787 |
| 4 | `RFQS` | 792 | 106 |
| 5 | `BIDS` | 808 | **671** (≤8 per RFQ) |
| 6 | `DOCS` | 824 | 168 |
| 7 | `FINAPPS` | 841 | 118 |
| 8 | `EXPOS` | 855 | 104 |
| 9 | `DISPUTES` | 867 | 94 |
| 10 | `AMLALERTS` | 887 | 112 |
| 11 | `AGENTRUNS` | 906 | 126 |
| 12 | `SETTLES` | 927 | 124 |
| 13 | `ABUSE` | 955 | 36 |
| 14 | `IDXSERIES` | 966 | 240 |
| 15 | `IDXLANE` | 967 | 8 + 320 points |
| 16 | `CDPACC` | 979 | 128 |
| 17 | `MERGEQ` | 995 | 8 (+19 records, no draws) |
| 18 | `LCS` | 2023 | 104 |
| 19 | `RATECARD` | 2239 | 416 |
| 20 | `VOYAGES` | 2493 | 104 |
| 21 | `FLEET` | 2774 | 100 |
| 22 | `PRODUCTS` | 3032 | **139** (103 `SP-` + 36 `LK-`) |
| 23 | `ASSETS` | 4016 | 98 |

`CAMPAIGNS` (942), `CONSENTS` (2153), `LANES`, `CORRIDORS`, `CARRIERS`, `AGENTS`, `SANDBOX`, `EQF`, `TSPORTS`, `COMMOD`, `PROD_L1`, `PROD_GROUPS` are static literals consuming no draws — but `ABUSE` (13) calls `pick(CAMPAIGNS)`, so campaigns must be loaded before it runs.

### Second-pass trap: `OFFERS.depN`

`OFFERS` does **not** finish drawing inside its main loop. After all 320 rows are built, a second loop assigns departure dates (line 787):

```js
out.forEach(function(o){ o.depN = ri(1,20); o.dep = dshort(o.depN) });
```

That is 320 additional `ri()` draws that happen **after** the last offer's other fields and **before** `RFQS` starts. Folding `depN` into the main loop — the obvious "tidier" port — consumes the draws in interleaved order instead of batched, desynchronising `RFQS` onward. Reproduce both passes exactly.

### Why draw order is not theoretical

The `ui.html` → `ui-2.html` revision is a live demonstration. Enlarging `OFFERS` (108→320 rows, more fields each) changed nothing before it and everything after it:

| Collection | Position vs OFFERS | `ui.html` | `ui-2.html` |
|---|---|---|---|
| `MEMBERS[0].score` | before | 53 | 53 — unchanged |
| `SHIPS[0]` | before | `VLX-2026-80005` qty 29 | identical |
| `RFQS[0].bids` | after | 15 | **11** |
| `DOCS[0].ref` | after | `EBL-2026-4002` | **`DOC-2026-4000`** |
| `BIDS` total | after | 708 | **671** |

Fixed-bound loops keep their row counts; anything data-dependent (like `BIDS`, sized by `RFQS[].bids`) moves. If seeded counts come out close-but-wrong, the stream desynchronised — bisect by asserting counts after each generator rather than adjusting loop bounds.

`MEMBERS` iterates `Object.keys(counts)` — insertion order `shipper, fwd, carrier, port, bank, tech` (56/22/16/14/14/6). Preserve it.

### Module layout

```
db/seed/prng.ts        R, ri, pick, pickw, d2, dstr, dshort — verbatim port
db/seed/pools.ts       VN_NAME, FDI_NAME, CARR_NAME, FWD_NAME, PORT_NAME,
                       BANK_NAME, INS_NAME, TECH_NAME, VESSELS, VESSEL_NAMES,
                       COUNTRIES, FOREIGN, FLAGS, CLASS_SOC  (lines 665–687, 2768)
db/seed/reference.ts   static reference rows + all label tables
db/seed/generated.ts   the 23 generators, in order
db/seed/index.ts       runner: truncate → reference → generated → verify counts
```

`generated.ts` will exceed 200 LOC. Split by domain (`generated-members.ts`, `generated-trading.ts`, …) **only if** the split preserves a single shared PRNG module instance and the runner invokes them in the order above. A split that reorders execution is a correctness bug, not a style choice.

### Determinism proof

Add `npm run db:checksum`:

```sql
SELECT md5(string_agg(t.row_hash, '' ORDER BY t.row_hash)) FROM (
  SELECT md5(m.*::text) AS row_hash FROM members m
  UNION ALL SELECT md5(s.*::text) FROM shipments s
  -- … every generated table
) t;
```

Record the value in `docs/data-dictionary.md`. Any future seed change that shifts it is either intentional or a regression — and this makes the difference visible.

## Related Code Files

- Create: `db/seed/prng.ts`, `db/seed/pools.ts`, `db/seed/reference.ts`, `db/seed/generated.ts`, `db/seed/index.ts`
- Create: `db/seed/checksum.sql`
- Modify: `package.json` (`db:seed`, `db:checksum`)
- Read: `ui-2.html`, `docs/data-dictionary.md`

## Implementation Steps

1. Port `prng.ts` verbatim. **Write a unit test first**: assert the first 10 draws match the float64 values above. Do not proceed until it passes.
2. Port `pools.ts` — copy name arrays exactly, including duplicates and ordering (duplicates drive the `used[base]` suffix logic at line 715).
3. Write `reference.ts` — static rows for all Phase 3 reference tables.
4. Port generators 1–23 in order into `generated.ts`, auditing each for the eager-evaluation trap before writing it.
5. Write the runner: truncate in FK-safe order, insert reference, insert generated, assert row counts.
6. Map generated objects to DB rows: resolve label tuples to reference-table FK ids; convert day offsets to real dates from the 2026-08-15 anchor. **Unit normalisation:** `members.limit` and `members.gmv` are already million VND — insert as-is into `credit_limit_m_vnd` / `gmv_m_vnd`. `corridors.gmv` is billion VND — multiply ×1000 before inserting into `gmv_m_vnd`.
7. Assign dates to `IDXSERIES` (240 daily points counting back from the anchor) and sequence numbers to `IDXLANE` points.
8. Run against a fresh database; fix count mismatches by re-auditing draw order, never by adjusting counts.
9. Run twice from empty; confirm identical checksums.
10. Record the checksum in `docs/data-dictionary.md`.

## Success Criteria

- [x] `prng.ts` unit test passes: first 10 draws match the float64 reference stream
- [x] `npm run db:seed` completes on a freshly migrated database in under 30s
- [x] Row counts exact: 128 members, 146 shipments, 320 offers, 106 RFQs, 671 bids, 168 documents, 118 finance applications, 104 exposures, 94 disputes, 112 AML alerts, 126 agent runs, 124 settlements, 36 abuse flags, 104 LCs, 416 rate cards, 104 voyages, 100 fleet assets, 139 products (103 SP- + 36 LK-), 98 asset-finance deals, 128 CDP accounts, 240 index points, 320 index lane points
- [x] Two seeds from empty produce identical checksums
- [x] Spot check: first 5 `members` rows match the prototype's values field-for-field (verify in a browser console against `ui-2.html`)
- [x] Spot check: `SHIPS[0]` and `RATECARD[0]` match the prototype
- [x] No CHECK constraint violated during seeding
- [x] Checksum recorded in `docs/data-dictionary.md`

## Risk Assessment

- **PRNG port divergence (R2) — the phase's dominant risk.** Mitigated by the step-1 unit test gate. If draws 1–10 match but row counts drift later, the cause is draw *order*, not the PRNG: bisect by checking counts after each generator.
- **Eager-evaluation trap.** Documented above with three known instances. Audit every generator; do not assume the list is complete.
- **Spot-check verification requires running the prototype.** Open `ui-2.html` in a browser and read `MEMBERS[0]` from the console. Comparing generator source by eye is not verification.
- **Row counts that "nearly" match** mean the stream desynchronised at a known point — that is diagnostic information, not something to paper over by adjusting loop bounds.
- **Truncation order.** FK constraints from Phase 5 mean truncation must be dependency-ordered or use `TRUNCATE … CASCADE`. Prefer explicit ordering so an accidental cascade cannot silently wipe reference data.
