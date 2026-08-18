---
phase: 4
title: "Transactional & Operational Schema"
status: pending
priority: P1
effort: "8h"
dependencies: [3]
---

# Phase 4: Transactional & Operational Schema

## Overview

Define every transaction and event table: trading, operations, finance, compliance, market data, and CDP. All labels come from Phase 3 reference tables via FK; these tables store facts only.

## Requirements

**Functional**
- All 23 transactional collections from `ui-2.html` modelled, with the exact row counts recorded for Phase 6.
- Every status/type field is an FK to a reference table or a `pgEnum` — never free text.
- Every scoped table carries `member_id` so row-level scoping can be added later without a migration (mitigates R1).
- Every table carrying a corridor context stores `corridor_id` (the prototype filters by corridor on most pages).

**Non-functional**
- One schema file per domain, each under 200 LOC.
- Foreign keys declared with explicit `onDelete` behaviour: `restrict` for reference FKs, `cascade` for child rows of an owning entity.

## Architecture

### `db/schema/trading.ts`

| Table | Rows | Source | Notes |
|---|---|---|---|
| `offers` | **320** | 767 | `bigserial` PK — prototype exposes no ref. See the expanded column list below. |
| `rfqs` | 106 | 792 | `id` text PK (`RFQ-2026-…`). `lane_code`, `scope_id`, `shipper_member_id`, `volume`, `bid_count`, `invited`, `status_code`, `closes_in_days`, `index_price`, `best_price`, `saving_pct`, `value`, `corridor_id` |
| `bids` | **671** (≤8 per RFQ) | 808 | `rfq_id` FK cascade, `carrier_code`, `price`, `transit_days`, `validity`, `score`, `allocation`, `status_code`, `lane_code` |
| `rate_cards` | 416 | 2239 | 8 lanes × 13 weeks × 4 equipment. `UNIQUE(lane_code, week, equipment_code)`. `current_price`, `index_price`, `suggested_price`, `capacity`, `sold`, `remaining`, `fill_pct`, `auto_pricing`, `published`, `days_out` |
| `voyages` | 104 | 2493 | `id` text PK (`VOY-…`). `vessel`, `lane_code`, `carrier_code`, `customer_member_id`, `eta`, `teu`, `reefer_teu`, `share_of_wallet`, `service_basket` jsonb, `discount_pct`, `value`, `status_code`, `corridor_id`, `confidence` |

#### `offers` — expanded in `ui-2.html`

The offers collection grew from 108 rows / 18 fields to **320 rows / 29 fields** when the market page gained a real search-and-match engine. Full column list:

| Group | Columns |
|---|---|
| Identity | `id` bigserial, `lane_code` FK, `carrier_code` FK, `vessel` |
| Equipment | `equipment_code` FK, `equipment_ord` (positional index into `EQF`), `equipment_factor` |
| Price breakdown | `price`, `base`, `thc`, `bunker`, `doc_fee`, `deviation_pct` |
| Routing | `transit_days`, `is_direct`, `transhipment_port` (NULL when direct), `depart_on`, `depart_offset` |
| Commercial | `slots_left`, `free_days`, `cutoff_days`, `validity_days`, `service_mode` FK, `weekly_frequency` |
| Quality / attributes | `reliability`, `rating`, `co2`, `has_finance`, `has_insurance`, `has_ebl`, `accepts_dg` |

New since `ui.html`: `equipment_ord`, `equipment_factor`, `transhipment_port`, `free_days`, `cutoff_days`, `validity_days`, `service_mode`, `weekly_frequency`, `rating`, `has_ebl`, `accepts_dg`.

Constraints and notes:

- `CHECK (is_direct = (transhipment_port IS NULL))` — the generator sets `ts: dir ? null : pick(TSPORTS)`.
- `doc_fee` is a **residual**, not a percentage: `doc = px - base - thc - round(px*0.062)` (line 773). It therefore absorbs rounding and the four components sum exactly to `price`. Worth a CHECK: `base + thc + bunker + doc_fee = price` — verify against the generator first, since `bunker` is rounded separately.
- `reliability` is clamped to 70–99 (`Math.max(70, Math.min(99, …))`), unlike `ui.html` which left it unbounded → `CHECK (reliability BETWEEN 70 AND 99)`.
- `co2` now scales with the equipment factor.
- `depart_on` is assigned in a **second pass** after all 320 rows are built (line 787) — a seed-ordering constraint, see Phase 6.

`voyages.service_basket` stays `jsonb` (`{port, truck, wh, cold, cust, ins}` booleans) — a six-column expansion buys nothing and the offering assistant reads it as a unit.

`rate_cards.week` is the prototype's `W34`…`W46` label; also store `week_index` (0-based) for ordering. Convert to real ISO week dates only if Phase 1 establishes the year mapping; otherwise keep the label and note it.

### `db/schema/operations.ts`

| Table | Rows | Source | Notes |
|---|---|---|---|
| `shipments` | 146 | 745 | `id` text PK (`VLX-2026-…`). `lane_code`, `carrier_code`, `shipper_member_id`, `qty`, `status_ordinal` FK, `etd`, `eta`, `value`, `cargo_value`, `vessel`, `risk_level`, `has_ebl`, `has_insurance`, `has_finance`, `corridor_id`, `in_dispute`, `doc_count` |
| `documents` | 168 | 824 | `id` text PK (`EBL-`/`DOC-…`). `doc_type_code`, `shipment_id`, `shipper_member_id`, `issued_on`, `status_code`, `signature_count`, `is_ebl`, `paper_fallback`, `corridor_id` |
| `disputes` | 94 | 867 | `id` text PK (`DIS-2026-…`). `shipment_id`, `issue_type_id`, `value`, `tier` (1–3), `status_code`, `days`, `claimant`, `respondent`, `auto_resolved`, `opened_on`, `corridor_id`, `evidence_source_id` |

`documents.doc_count` on `shipments` is a denormalised counter the prototype generates independently (`ri(4,8)`), not a true count of `documents` rows. Store it as-is and comment that it is prototype data, not a derived aggregate — otherwise Phase 7 verification will chase a false discrepancy.

### `db/schema/finance.ts`

| Table | Rows | Source | Notes |
|---|---|---|---|
| `letters_of_credit` | 104 | 2023 | `id` text PK (`LC-2026-…`). `lc_type_id`, `applicant_member_id`, `beneficiary`, `bank`, `shipment_id`, `lane_code`, `amount`, `step_ordinal` FK, `discrepancies`, `opened_on`, `expires_on`, `turnaround_hours`, `doc_count`, `auto_checked`, `corridor_id` |
| `finance_applications` | 118 | 841 | `id` text PK (`CR-2026-…`). `member_id`, `product_code`, `amount`, `score`, `decision_code` FK, `rate`, `pd`, `turnaround_hours`, `auto_decided`, `applied_on`, `bank`, `corridor_id` |
| `credit_exposures` | 104 | 855 | `member_id` UNIQUE FK, `exposure`, `ifrs9_stage` enum (s1/s2/s3), `collateral`, `ecl`, `days_past_due` |
| `settlements` | 124 | 927 | `id` text PK (`STL-2026-…`). `shipment_id`, `counterparty`, `carrier`, `amount`, `trigger_id` FK, `status_code`, `is_matched`, `settled_on`, `payment_ref`, `bank`, `early_payment`, `corridor_id` |
| `asset_finance_deals` | 98 | 4016 | `id` text PK (`AF-2026-…`). `asset_finance_type_id`, `member_id`, `amount`, `ltv`, `term_years`, `rate`, `status_code`, `irr`, `dscr`, `collateral_type_id`, `esg_grade`, `originated_on`, `bank` |

`bank` is a plain text column across finance tables — the prototype picks from a fixed list (`HDBank`, `MBBank`, `SHB`, `TPBank`, `Sovico Finance`) but those institutions also exist as rows in `members`. Decide once: either FK to `members` (correct, but the prototype's picks may not resolve to seeded member names) or keep text. Recommend **text with a documented rationale** — the prototype treats them as external counterparties, not platform members. Record the decision in the data dictionary.

### `db/schema/compliance.ts`

| Table | Rows | Source | Notes |
|---|---|---|---|
| `aml_alerts` | 112 | 887 | `id` text PK (`AML-2026-…`). `alert_type_id`, `member_id`, `severity_code`, `status_code`, `raised_on`, `score`, `agent_flagged`, `tier`, `value` |
| `abuse_flags` | 36 | 955 | `id` text PK (`AB-…`). `abuse_type_id`, `member_id`, `campaign_id`, `amount`, `status_code`, `flagged_on` |
| `agent_runs` | 126 | 906 | `id` text PK (`RUN-…`). `agent_id`, `action_id`, `tier`, `outcome_code`, `confidence`, `duration_ms`, `run_at` time, `approver`, `model`, `shipment_id` |
| `consent_grants` | 7 per member (seeded for the demo shipper only) | 2153 | `member_id`, `purpose_id`, `granted`, `revocable`, `UNIQUE(member_id, purpose_id)` |

`agent_runs.run_at` is a bare `HH:MM:SS` in the prototype with no date. Store `time` plus a `run_on` date defaulted to the 2026-08-15 anchor so the column is queryable as a timestamp later.

### `db/schema/market.ts`

| Table | Rows | Source |
|---|---|---|
| `index_points` | 240 | 927 — `observed_on` date UNIQUE, `value` |
| `index_lane_stats` | 8 | 928 — `lane_code` PK, `level`, `d1`, `w1`, `m1`, `ytd`, `quality_grade`, `trades`, `providers` |
| `index_lane_points` | 320 | 936 — `lane_code`, `seq`, `value`, `UNIQUE(lane_code, seq)` |

The prototype's index series carry no dates. Assign daily dates counting back from the 2026-08-15 anchor (240 points → 2025-12-19 onward) so the series is orderable in SQL rather than by array position.

### `db/schema/cdp.ts`

| Table | Rows | Source | Notes |
|---|---|---|---|
| `cdp_accounts` | 128 | 979 | `member_id` UNIQUE FK, `segment_id`, `share_of_wallet`, `revenue`, `trend`, `churn_risk_code`, `source_count`, `confidence`, `is_merged`, `services` jsonb, `nba_action_id` |
| `cdp_merge_queue` | 8 | 995 | `golden_name`, `confidence`, `tax_id_masked`, `status` |
| `cdp_merge_records` | 19 | 995 | `queue_id` FK cascade, `source_record`, `ord` |

`cdp_merge_queue.tax_id_masked` holds already-masked values (`2300xxxxxx`) in the prototype. Keep them masked in the DB — there is no auth and no reason to store real tax IDs (R1).

## Related Code Files

- Create: `db/schema/trading.ts`, `db/schema/operations.ts`, `db/schema/finance.ts`, `db/schema/compliance.ts`, `db/schema/market.ts`, `db/schema/cdp.ts`
- Modify: `db/schema/index.ts` (re-exports), `db/schema/enums.ts` (add `ifrs9_stage`, `esg_grade`, `dispute_tier`, `risk_level`)
- Read: `docs/data-dictionary.md`, `ui-2.html`

## Implementation Steps

1. Write `trading.ts` — offers, rfqs, bids, rate_cards, voyages.
2. Write `operations.ts` — shipments, documents, disputes.
3. Write `finance.ts` — LCs, applications, exposures, settlements, asset finance deals.
4. Write `compliance.ts` — AML alerts, abuse flags, agent runs, consent grants.
5. Write `market.ts` — index points, lane stats, lane points.
6. Write `cdp.ts` — accounts, merge queue, merge records.
7. Add the composite UNIQUE constraints: `rate_cards`, `index_lane_points`, `consent_grants`, `credit_exposures.member_id`, `cdp_accounts.member_id`.
8. Set FK delete behaviour: `restrict` on reference FKs, `cascade` on `bids`→`rfqs` and `cdp_merge_records`→`cdp_merge_queue`.
9. Extend `enums.ts` and re-export from `index.ts`.
10. Run `npx drizzle-kit generate` to confirm compilation.

## Success Criteria

- [x] All 23 transactional tables defined across 6 schema files
- [x] `npx drizzle-kit generate` completes clean
- [x] Zero free-text status or type columns — grep for `text('status')` returns nothing
- [x] Every scoped table has a `member_id` FK (R1 mitigation)
- [x] Composite UNIQUE constraints present on all five tables listed in step 7
- [x] `bank`-as-text decision recorded in the data dictionary with rationale
- [x] Index series carry real dates, not array positions
- [x] No schema file exceeds 200 LOC

## Risk Assessment

- **Denormalised counters** (`shipments.doc_count`, `rfqs.bid_count`, `members.teu`) are independent prototype values, not aggregates. If Phase 7 treats them as derivable, verification will fail against correct data. Comment each one at the column.
- **`bank` text vs FK** — choosing FK late forces a migration plus a seed rewrite. Decide in step 3, not during implementation.
- **`corridor_id` denormalisation.** Most tables can reach corridor via `lane_code → lanes.corridor_id`, but the prototype stores it directly and filters on it everywhere. Storing it is intentional denormalisation for query simplicity; add a comment so a future reader does not "fix" it. Risk: it can drift from the lane's corridor — add a Phase 7 consistency check.
- **`agent_runs` has no date**, only a time. The anchor default is an invention beyond the prototype; document it as such in the data dictionary rather than presenting it as source-derived.
