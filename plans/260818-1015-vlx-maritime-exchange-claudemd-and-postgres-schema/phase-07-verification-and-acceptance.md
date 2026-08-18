---
phase: 7
title: "Verification & Acceptance"
status: pending
priority: P2
effort: "4h"
dependencies: [6]
---

# Phase 7: Verification & Acceptance

## Overview

Prove the schema can serve the prototype. Write SQL reproducing the headline figures of each persona's pages and check them against the values `ui-2.html` renders. Anything the schema cannot answer is a coverage gap to fix, not a query to skip.

## Requirements

**Functional**
- A verification query per persona home page reproducing its KPI tiles.
- Queries for the five nav badge counts.
- Referential and denormalisation consistency checks.
- Results compared against the live prototype, not against expectations.

**Non-functional**
- Queries live in `db/verify/` as runnable `.sql` files, each with its expected value in a header comment.
- One command runs them all and reports pass/fail.

## Architecture

### KPI parity checks

For each persona home page, reproduce its tiles in SQL and diff against the browser:

| Page | Source | Checks |
|---|---|---|
| Shipper home | `pageSHome` 1196 | open RFQs closing ≤3d, active shipments, escrow held, docs pending |
| Carrier home / dashboard | `pageCHome` 1246, `pageCDash` 2284 | fill rate, capacity sold, bid win rate, assets needing attention |
| Platform ops console | `pageXOps` 3406 | members by KYB state, GMV, corridor volumes, open disputes |
| Financial institution home | `pageFHome` 1295 | approved applications, TAT, portfolio exposure, ECL, IFRS-9 stage split |
| Regulator dashboard | `pageRDash` 4408 | sandbox utilisation vs cap, agent runs by tier, override rate |
| CDP home / 360 | `pageCdpHome` 1345, `pageCDP` 4792 | accounts by segment, share of wallet, churn risk split, merge queue |

### Nav badge queries

There are **five** badges (lines 495, 512, 514, 525, 526), recomputed on every navigation and persona switch. Each must be a single indexed query:

```sql
-- 1. Shipper: open RFQs closing within 3 days               (line 495)
SELECT count(*) FROM rfqs WHERE status_code='open' AND closes_in_days <= 3;

-- 2. Carrier bid inbox: all open RFQs                       (line 512)
SELECT count(*) FROM rfqs WHERE status_code='open';

-- 3. Carrier: assets with certificates <45d or maintenance <21d  (line 514)
SELECT count(*) FROM fleet_assets WHERE cert_days < 45 OR maint_due_days < 21;

-- 4. Ops: members with incomplete KYB                       (line 525)
SELECT count(*) FROM members WHERE kyb_status_code <> 'done';

-- 5. Ops: high-severity AML alerts open or under review     (line 526)
SELECT count(*) FROM aml_alerts WHERE severity_code='high' AND status_code IN ('open','review');
```

### Consistency checks (expect 0 rows each)

```sql
-- corridor_id must agree with the lane's corridor (Phase 4 denormalisation risk)
SELECT count(*) FROM shipments s JOIN lanes l ON l.code=s.lane_code
WHERE s.corridor_id <> l.corridor_id;
-- repeat for rfqs, documents, disputes, settlements, rate_cards, voyages, products, fleet_assets

-- every bid belongs to a real RFQ and its lane agrees
SELECT count(*) FROM bids b JOIN rfqs r ON r.id=b.rfq_id WHERE b.lane_code <> r.lane_code;

-- no orphaned reference FKs
SELECT count(*) FROM shipments WHERE status_ordinal NOT IN (SELECT ordinal FROM shipment_statuses);

-- rate card grid is complete: 8 lanes x 13 weeks x 4 equipment
SELECT count(*) FROM rate_cards;  -- expect 416

-- exposures cover only members with a credit limit
SELECT count(*) FROM credit_exposures e JOIN members m ON m.id=e.member_id WHERE m.credit_limit <= 0;
```

Note: `shipments.doc_count`, `rfqs.bid_count`, and `members.teu` are independent prototype values, **not** aggregates (Phase 4). Do not write checks asserting they equal a `count(*)` — they will fail against correct data.

### Coverage audit

Final sweep: for each of the 38 routes in `ROUTES` (line 4941), confirm every value the page renders is either (a) queryable from the schema, (b) a static label in a reference table, or (c) computed client-side from queryable inputs. Record any value that is none of these as a coverage gap.

## Related Code Files

- Create: `db/verify/*.sql`, `db/verify/run.ts`
- Modify: `package.json` (`db:verify`)
- Modify: `docs/data-dictionary.md` (record results + checksum)
- Modify: `CLAUDE.md` (finalise the provisional commands/conventions sections from Phase 2)

## Implementation Steps

1. Write the five nav badge queries; compare against badge numbers rendered by `ui-2.html` in a browser.
2. Write KPI parity queries for all six persona home pages.
3. Write the consistency checks; every one must return 0.
4. Write `db/verify/run.ts` — execute each `.sql`, compare against its expected-value header, report pass/fail.
5. Run the full suite; investigate every mismatch. A mismatch means the schema, the seed, or the expected value is wrong — determine which before changing anything.
6. Run the 38-route coverage audit; log gaps.
7. Fix coverage gaps by amending Phase 3/4 schema and re-running Phase 5/6.
8. Record final row counts, the seed checksum, and audit results in `docs/data-dictionary.md`.
9. Revisit `CLAUDE.md`: confirm every command runs as written and the DB conventions match what shipped.

## Success Criteria

- [x] All five nav badge queries match the prototype's rendered badges exactly
- [x] All six persona home pages have KPI parity queries; results match the prototype
- [x] All consistency checks return 0
- [x] `npm run db:verify` runs the suite and reports pass/fail per query
- [x] 38-route coverage audit complete; zero unresolved gaps, or each gap logged with a rationale
- [x] `docs/data-dictionary.md` updated with final counts, checksum, and audit results
- [x] `CLAUDE.md` commands verified runnable end to end on a clean checkout
- [x] Full path works from scratch: `db:migrate` → `db:seed` → `db:verify`

## Risk Assessment

- **Expected values drift from the prototype.** Read them from a live browser render, not from generator source. Reading a value off the generator reproduces any misreading made in Phase 6 — the check then confirms the bug instead of catching it.
- **Coverage gaps found late** force schema changes after migrations exist. Cheap here (dev-only, no production data): amend the schema and regenerate rather than patching with a follow-on migration.
- **Aggregate-vs-stored confusion.** Three known denormalised counters are called out above. If a fourth appears, add it to the list rather than "fixing" the seed to satisfy a check that should not exist.
- **Phase 2 provisional sections.** `CLAUDE.md` was written before the schema existed. Step 9 is mandatory, not optional — an instruction file with commands that do not run is worse than none.
