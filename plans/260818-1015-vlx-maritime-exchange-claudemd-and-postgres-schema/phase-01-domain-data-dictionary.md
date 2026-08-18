---
phase: 1
title: "Domain Extraction & Data Dictionary"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Domain Extraction & Data Dictionary

## Overview

Read `ui-2.html` end to end and produce `docs/data-dictionary.md` — the authoritative mapping from every prototype data collection to its destination table, column, type, unit, and source line. No schema code is written in this phase; this is the contract phases 3–6 implement against.

## Requirements

**Functional**
- Every `var X=[...]` / `var X=(function(){...})()` collection in `ui-2.html` appears in the dictionary with its source line range and row count.
- Every field of every collection maps to a column, or is explicitly marked *derived* (computed at render time, not stored).
- Every inline bilingual `[vi,en]` tuple inside a generator is promoted to a named reference table.
- All units and currencies are resolved by reading the **render site**, not the generator.

**Non-functional**
- Dictionary is readable by someone who has never opened `ui-2.html`.
- Under `docs.maxLoc` (800 lines); split by domain if it exceeds.

## Architecture

Three passes over `ui-2.html`:

1. **Collection inventory** — enumerate top-level data vars (lines 468–1014, 1401, 2023, 2153, 2238, 2493, 2759, 3009, 4016) and the two static matrices at 4551–4600.
2. **Field typing** — for each field, record the generator expression, inferred SQL type, nullability, and whether it is a value, a FK, or derived.
3. **Unit resolution** — for every numeric field, grep the field's usage in page render functions to find its display unit (`usd()`, `vnd()`, `n()`, `pct()`, or a literal suffix such as `tỷ đ` / `bn VND` / `TEU`).

Derived-vs-stored rule: if the prototype computes a field from other stored fields at generation time and never varies it independently, store it anyway when the UI sorts or filters on it (e.g. `fill = sold/cap`); otherwise mark derived. Prefer Postgres generated columns for pure functions of same-row data.

### Bilingual promotion list

Inline `[vi,en]` tuples to promote into reference tables:

| Source | Line | Destination table |
|---|---|---|
| `STNAMES` shipment statuses | 740 | `shipment_statuses` |
| `DOCS` types array | 825 | `document_types` |
| `FINPROD` | 837 | `finance_products` |
| `DISPUTES` issues array | 868 | `dispute_issue_types` |
| `DISPUTES` src field | 881 | `evidence_sources` |
| `AMLALERTS` types array | 888 | `aml_alert_types` |
| `AGENTRUNS` acts array | 907 | `agent_actions` |
| `SETTLES` trig field | 932 | `settlement_triggers` |
| `ABUSE` ty array | 956 | `abuse_types` |
| `RFQS` scopes array | 794 | `rfq_scopes` |
| `LCS` types + steps | 2025 | `lc_types`, `lc_steps` |
| `CDPACC` segs array | 980 | `cdp_segments` |
| `CDPACC` nba array | 990 | `cdp_nba_actions` |
| `ASSETS` types array | 4017 | `asset_finance_types` |
| `ASSETS` coll field | 4029 | `collateral_types` |
| `SECTORS` | 688 | `sectors` |
| `MTYPES` | 691 | `member_types` |
| `ASSET_TYPES` | 2759 | `asset_types` |
| `PROD_GROUPS` (now 12 rows, +industry +source) | 3015 | `product_groups` |
| `ST_TAGS` (shared status dictionary) | 1091 | `status_labels` |
| `PROD_L1` product industries — **new in `ui-2.html`** | 3009 | `product_industries` |
| `COMMOD` commodity types — **new in `ui-2.html`** | 1401 | `commodity_types` |
| `OFFERS` svc field — **new in `ui-2.html`** | 782 | `service_modes` |

`ST_TAGS` is a single global code→(tone, vi, en) map reused across every domain. Model it as **one** `status_labels` table, not per-domain label columns — the largest DRY win available in this schema.

## Related Code Files

- Create: `docs/data-dictionary.md`
- Read: `ui-2.html`

## Implementation Steps

1. Extract the collection inventory with line ranges and row counts; record as a table.
2. For each collection, list fields with generator expression and proposed column name (snake_case) plus SQL type.
3. Resolve units: grep each numeric field's usage inside `page*()` functions; record display unit and canonical storage unit.
4. Apply the unit resolutions already settled in validation session 1 (see `plan.md` Open Questions): `members.limit` and `members.gmv` are million VND; `corridors.gmv` is billion VND and must be scaled ×1000 into `gmv_m_vnd`. Escalate any newly discovered unit ambiguity to the user.
5. List the bilingual promotions (table above) with final table names and row counts.
6. Mark derived fields; propose Postgres generated columns where applicable.
7. Record the PRNG contract: LCG constants, seed value, and call order across generators (line 652 onward).

## Success Criteria

- [ ] `docs/data-dictionary.md` created
- [ ] All ~50 collections inventoried with source line ranges and expected row counts
- [ ] Every field classified: stored / FK / derived
- [ ] Every numeric field has a resolved unit and canonical storage unit, or an explicit open question
- [ ] All 23 bilingual promotions named
- [ ] PRNG call order documented as an ordered list — this is the Phase 6 contract
- [ ] Zero fields left as "unknown"

## Risk Assessment

- **Unit ambiguity may be unresolvable from source alone** (R3). Do not guess. Record as an open question and surface it to the user before Phase 3 — a wrong unit silently corrupts every downstream figure.
- **Miscounted PRNG call order** breaks all of Phase 6 (R2). Derive the order by reading generator definitions top-to-bottom in source order; generators execute at parse time, so file order *is* call order.
- **Scope creep into schema design.** This phase produces a dictionary, not DDL. Column names and types are proposals that Phase 3/4 implement.
