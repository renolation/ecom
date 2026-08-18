---
phase: 5
title: "Migrations, Indexes & Constraints"
status: pending
priority: P1
effort: "3h"
dependencies: [4]
---

# Phase 5: Migrations, Indexes & Constraints

## Overview

Generate and apply the initial migration, then add the indexes and integrity constraints the prototype's access patterns demand. Index choices are driven by what the 38 pages actually filter, sort, and aggregate on — not by guesswork.

## Requirements

**Functional**
- `db/migrations/` contains generated SQL applying cleanly to an empty Postgres 17 database.
- Indexes cover every filter/sort path used by the prototype's data tables and heatmaps.
- CHECK constraints encode the invariants the generators guarantee.
- `npm run db:migrate` is idempotent and safe to re-run.

**Non-functional**
- No index without a named access pattern justifying it. Over-indexing a demo dataset costs write time and hides real problems.
- Migration SQL is generated, not hand-written; hand edits only for CHECKs and comments drizzle-kit cannot express.

## Architecture

### Access patterns driving indexes

The prototype's reusable `dataTable()` (line 1024) gives every list page search, filter, sort, and pagination. Derive indexes from the filters actually declared per page:

| Index | Table(s) | Access pattern |
|---|---|---|
| `(corridor_id)` | shipments, rfqs, documents, disputes, settlements, finance_applications, letters_of_credit, rate_cards, voyages, products, fleet_assets | Corridor filter appears on nearly every page |
| `(status_code)` | rfqs, settlements, disputes, aml_alerts, documents, products, fleet_assets | Status filter chips |
| `(lane_code)` | offers, shipments, rfqs, rate_cards, voyages, index_lane_points | Lane filter + lane roll-ups |
| `(carrier_code)` | offers, shipments, bids, voyages | Carrier filter |
| `(member_id)` | finance_applications, aml_alerts, abuse_flags, credit_exposures, cdp_accounts, asset_finance_deals | Member drill-down from the members page |
| `(shipment_id)` | documents, disputes, settlements, letters_of_credit, agent_runs | Shipment 360 view |
| `(rfq_id)` | bids | Bid inbox per RFQ |
| `(lane_code, week_index, equipment_code)` | rate_cards | Heatmap grid scan (line 2257 `hmRows()`) |
| `(severity_code, status_code)` | aml_alerts | Nav badge 5: high-severity open/review count (line 526) |
| `(kyb_status_code)` | members | Nav badge 4: non-`done` KYB count (line 525) |
| `(cert_days, maint_due_days)` | fleet_assets | Nav badge 3: certs <45d or maintenance <21d (line 514) |
| `(observed_on)` | index_points | Time-series scan |
| `(status_code, closes_in_days)` | rfqs | Nav badge 1: open RFQs closing within 3 days (line 495) |
| `(status_code)` | rfqs | Nav badge 2: all open RFQs, carrier bid inbox (line 512) |

There are **five** nav badge queries (verified: `grep -c "badge:function" ui-2.html` = 5). They recompute on every **navigation** and persona switch — `go()` calls `renderNav()`, which invokes each `badge()`; a bare `render()` does not. Still the hottest paths in the schema — index them deliberately.

Badges 1 and 2 both hit `rfqs.status_code`; badge 1 additionally filters `closes_in_days`. A single composite `(status_code, closes_in_days)` serves both — do not add a second index.

### CHECK constraints

Encode invariants the generators guarantee:

```sql
-- shipments
CHECK (qty > 0)
CHECK (eta >= etd)
CHECK (risk_level BETWEEN 0 AND 2)

-- rate_cards
CHECK (sold <= capacity)
CHECK (remaining = capacity - sold)
CHECK (fill_pct BETWEEN 0 AND 100)

-- products
CHECK ((lane_code IS NULL) <> (site_vi IS NULL))   -- from Phase 3
CHECK (sold <= capacity)
CHECK (price > 0 AND cost > 0 AND cost < price)

-- members
CHECK (score BETWEEN 0 AND 100)
CHECK (utilisation_pct BETWEEN 0 AND 100)

-- disputes / agent_runs / aml_alerts
CHECK (tier BETWEEN 1 AND 3)

-- ai_agents
CHECK (tier BETWEEN 1 AND 3)
CHECK (accuracy BETWEEN 0 AND 100)

-- bids
CHECK (score BETWEEN 0 AND 100)
```

Verify each against its generator before adding. `cost < price` holds for both product sources: internal `price × (0.62 + R()×0.24)`, partner `price × (0.905 + R()×0.07)` — max 0.975 (line 3076). But confirm the equivalent for every constraint — a CHECK the seed violates blocks Phase 6 entirely.

### Corridor consistency

`corridor_id` is denormalised alongside `lane_code` (Phase 4 risk). Add a validation query, not a constraint — a trigger or composite FK would be heavier than this demo warrants:

```sql
SELECT count(*) FROM shipments s
JOIN lanes l ON l.code = s.lane_code
WHERE s.corridor_id <> l.corridor_id;   -- expect 0
```

Run it in Phase 7 across every table carrying both columns.

## Related Code Files

- Create: `db/migrations/0000_*.sql` (generated), `db/migrate.ts` (runner)
- Modify: `db/schema/*.ts` (add index and CHECK declarations)
- Modify: `package.json` (`db:migrate` script)

## Implementation Steps

1. Add `index()` / `uniqueIndex()` declarations to the schema files per the table above.
2. Add CHECK constraints via drizzle's `check()` helper; verify each against its generator expression first.
3. Run `npx drizzle-kit generate` to emit the initial migration.
4. Review the generated SQL by hand — confirm FK actions, CHECK text, and that no unintended `DROP` appears.
5. Write `db/migrate.ts` using drizzle's migrator; wire `npm run db:migrate`.
6. Apply to a scratch database; confirm clean apply from empty.
7. Re-run `db:migrate` to confirm idempotency (no-op on second run).
8. Run `npx drizzle-kit generate` again — must report no drift.

## Success Criteria

- [x] `npm run db:migrate` applies cleanly to an empty Postgres 17 database
- [x] Second `npm run db:migrate` is a no-op
- [x] `npx drizzle-kit generate` reports zero drift after migration
- [x] All five nav-badge access paths are indexed
- [x] Every CHECK constraint verified against its generator expression
- [x] Generated SQL reviewed by hand; no unintended DROP or CASCADE
- [x] Index count is justified — each one maps to a named access pattern in the table above

## Risk Assessment

- **A CHECK the seed violates blocks Phase 6 completely.** Verify each constraint against the generator *expression*, not intuition. `remaining = capacity - sold` looks obvious but the prototype clamps with `Math.max(0, …)` and `Math.min(sold, cap)` (line 2247) — confirm the clamps make the identity exact.
- **Drizzle CHECK support varies by version.** If `check()` is unavailable in the pinned version, add constraints in a hand-written follow-on migration and note it, rather than silently dropping them.
- **Over-indexing.** Every index listed has a named access pattern. Reject additions without one; on a 2,000-row demo dataset most indexes are theatre.
- **`ON DELETE` semantics on reference FKs.** `restrict` is correct here (reference rows should never be deleted), but confirm drizzle emits it rather than defaulting to `NO ACTION` with different deferred behaviour.
