---
phase: 3
title: "Reference & Master Schema"
status: pending
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 3: Reference & Master Schema

## Overview

Stand up the Drizzle toolchain and define the reference (lookup) and master-entity tables. Reference tables hold all bilingual labels; every table added later carries FKs into them and never duplicates a label.

## Requirements

**Functional**
- Drizzle toolchain runnable: `drizzle.config.ts`, `package.json` scripts, `.env.example` with `DATABASE_URL`.
- All reference tables from Phase 1's promotion list defined.
- Master entities defined: `members`, `fleet_assets`, `products`.
- `status_labels` is the single shared status dictionary (`ST_TAGS`, line 1091) — one table, not per-domain label columns.
- Bilingual pairs are `*_vi` / `*_en` `text` columns, both `NOT NULL`.

**Non-functional**
- Schema files under 200 LOC each; split by domain per the layout in `plan.md`.
- Every table carries a comment citing its `ui-2.html` line range.
- snake_case throughout; plural table names.

## Architecture

### Toolchain

Minimum viable — no app code:

```
package.json     drizzle-orm, drizzle-kit, pg, tsx, typescript
                 scripts: db:generate, db:migrate, db:seed, db:studio
tsconfig.json    strict, ESNext modules
drizzle.config.ts  schema: ./db/schema/index.ts, out: ./db/migrations, dialect: postgresql
```

### `db/schema/reference.ts`

| Table | Source line | Key columns |
|---|---|---|
| `status_labels` | 1091 | `code` PK, `tone`, `name_vi`, `name_en` |
| `personas` | 468 | `code` PK, `icon`, `name_vi/en`, `org_vi/en`, `initials`, `home_route` |
| `nav_groups` | 489 | `id`, `persona_code` FK, `ord`, `name_vi/en` |
| `nav_items` | 489 | `id`, `group_id` FK, `ord`, `route`, `icon`, `label_vi/en`, `module_code` FK, `is_ai`, `is_new` |
| `modules` | nav + 4551 | `code` PK (F02…F15), `name_vi/en` |
| `sandbox_programs` | 619 | `code` PK (SB-01…SB-08), `name_vi/en`, `participants_vi/en`, `features_vi/en`, `controls_vi/en`, `status_code` FK, `used`, `cap`, `module_code` FK |
| `corridors` | 575 | `id` PK, `name_vi/en`, `route`, `use_case_vi/en`, `status_code` FK, `suppliers`, `shippers`, `teu`, `gmv_m_vnd`, `quality`, `time_to_quote`, `repeat_rate`, `pl` |
| `ports` | derived from 565 | `code` PK (VNCMT…), `name`, `country_code` |
| `lanes` | 565 | `code` PK (CMT-SIN), `origin_port_code` FK, `dest_port_code` FK, `index_price`, `change_pct`, `volume_teu`, `transit_days`, `corridor_id` FK |
| `transhipment_ports` | 766 | `name` PK — the 6 `TSPORTS` values used by indirect offers. Seed as `ports` rows flagged `is_transhipment` if they resolve; otherwise its own small table. |
| `carriers` | 586 | `code` PK (PL), `name`, `color`, `reliability`, `co2_grade` |
| `ai_agents` | 595 | `id` PK, `icon`, `name_vi/en`, `task_vi/en`, `control_vi/en`, `tier`, `runs`, `accuracy`, `override_rate` |
| `member_types` | 691 | `code` PK, `name_vi/en`, `share_pct` |
| `sectors` | 688 | `id` PK, `name_vi/en` |
| `equipment_types` | 765 (`EQF`), 2238 (`RC_EQ`) | `code` PK, `teu_factor`, `capacity_factor`, `ord` — **both arrays list the same 4 equipment codes in the same order**; merge into one table, keep `ord` because `offers.eqi` is a positional index into `EQF` |
| `service_modes` | 782 | `code` PK — `CY/CY`, `CY/Door`, `Door/Door`, `weight` |
| `commodity_types` | 1401 | `code` PK, `name_vi/en` — 8 rows (general, garment, electro, agri, furniture, chem, dg, reefer) |
| `shipment_statuses` | 740 | `ordinal` PK 0–7, `name_vi/en` |
| `document_types` | 825 | `code` PK, `name_vi/en`, `weight` |
| `finance_products` | 837 | `code` PK, `name_vi/en`, `module_code` FK, `weight` |
| **`product_industries`** | **3009** | **NEW.** `code` PK (transport/infra/trade/partner), `name_vi/en`, `icon`, `source` (`in`/`out`) — level 1 of the 4-level product taxonomy |
| `product_groups` | 3015 | `code` PK, `name_vi/en`, `icon`, **`industry_code` FK → `product_industries`**, **`source`** (`in`/`out`). **Now 12 rows** (was 8): added `ins`, `fuel`, `fin`, `mar` — all partner-provided |
| `lifecycle_stages` | 3031 | `code` PK, `name_vi/en` |
| `asset_types` | 2759 | `code` PK, `name_vi/en`, `icon`, `seed_count` |
| `fleet_statuses` | 2825 | `code` PK, `name_vi/en` |
| `ownership_types` | 2827 | `code` PK, `name_vi/en` |
| `lc_types` | 2025 | `id` PK, `name_vi/en`, `weight` |
| `lc_steps` | 2027 | `ordinal` PK 0–5, `name_vi/en` |
| `rfq_scopes` | 794 | `id` PK, `name_vi/en` |
| `dispute_issue_types` | 868 | `id` PK, `name_vi/en`, `weight` |
| `evidence_sources` | 881 | `id` PK, `name_vi/en` |
| `aml_alert_types` | 888 | `id` PK, `name_vi/en`, `weight` |
| `abuse_types` | 956 | `id` PK, `name_vi/en`, `weight` |
| `agent_actions` | 907 | `id` PK, `name_vi/en` |
| `settlement_triggers` | 932 | `id` PK, `name_vi/en`, `weight` |
| `collateral_types` | 4029 | `id` PK, `name_vi/en`, `weight` |
| `asset_finance_types` | 4017 | `id` PK, `name_vi/en`, `structure` (term/lease/proj), `weight` |
| `cdp_segments` | 980 | `id` PK, `name_vi/en`, `weight` |
| `cdp_nba_actions` | 990 | `id` PK, `name_vi/en`, `weight` |
| `campaigns` | 942 | `id` PK, `name_vi/en`, `target_vi/en`, `budget`, `used`, `activated`, `repeat_rate`, `cpa`, `status_code` FK, `rule_vi/en` |
| `consent_purposes` | 2153 | `id` PK, `purpose_vi/en`, `counterparty`, `data_scope_vi/en`, `legal_basis_vi/en`, `retention_months`, `revocable` |
| `licence_matrix` | 4556 | `id` PK, `service_vi/en`, `responsible_vi/en`, `platform_role_vi/en`, `licence_needed` (n/p/y), `module_codes` |
| `decision_rights` | 4583 | `id` PK, `matter_vi/en`, `platform`, `provider`, `bank`, `insurer`, `regulator` |

**Not modelled — UI state, not data.** `MK` (market search form state, line 1398), `TR` (product tree open/selected state, line 3109), and `ORIG`/`DEST` (dropdown options derived from `LANES` at 1459–1460) are ephemeral browser state. They belong in React state, not Postgres. `COMMOD` and `TSPORTS`, by contrast, *are* reference data and are tabled above.

`weight` columns preserve the prototype's `pickw()` distributions so Phase 6 can reproduce them from the DB rather than hardcoding them twice.

### `db/schema/master.ts`

**`members`** (128 rows, line 709) — `id` text PK (`MB-1000`+), `name`, `type_code` FK, `sector_id` FK, `country_code`, `rating` (AAA…CCC), `score`, `credit_limit_m_vnd`, `utilisation_pct`, `teu`, `gmv_m_vnd`, `kyb_status_code` FK, `risk_level_code` FK, `compliance_status_code` FK, `tier` (direct/clearing/broker/data), `joined_on` date, `wait_days`, `corridor_id` FK, `active_30d`, `repeat_90d`.

**`fleet_assets`** (100 rows, line 2774) — `id` text PK (`VSL-`/`TRK-`/`CTR-`/`EQP-`), `asset_type_code` FK, `name`, `is_ship`, `capacity`, `capacity_unit`, `built_year`, `flag`, `class_society`, `status_code` FK, `ownership_code` FK, `lane_code` FK, `corridor_id` FK, `utilisation_pct`, `position`, `speed_knots`, `fuel`, `co2`, `cii_grade`, `insurance_type`, `cert_days`, `maint_on` date, `maint_due_days`, `opex`, `revenue`, `asset_value`, `is_financed`, `dscr`, `crew`, `imo`.

`age` is derived (`2026 - built_year`) — Postgres generated column, not stored input.

**`products`** (Product 360 catalogue, **139 rows**, line 3032) — `id` text PK, `group_code` FK, **`industry_code` FK → `product_industries`**, **`source`** (`in`/`out`), **`partner_name`** nullable, `base_name_vi/en`, `variant_vi/en`, `lane_code` FK nullable, `site_vi/en` nullable, `unit_vi/en`, `periods_per_year`, `price`, `cost`, `margin_pct`, `index_ref`, `capacity`, `sold`, `fill_pct`, `customers`, `revenue`, `trend`, `lifecycle_code` FK, `attach_rate`, `sla`, `sla_hit`, `rating`, `status_code` FK, `corridor_id` FK, `is_bundle`.

**Internal vs partner-provided.** `ui-2.html` splits the catalogue in two:

| | Internal | Partner-provided |
|---|---|---|
| `id` prefix | `SP-` | `LK-` (liên kết) |
| Rows | 103 | 36 |
| `source` | `in` | `out` |
| Industries | transport, infra, trade | partner |
| Groups | ocean, feeder, road, wh, cold, depot, cus, vas | ins, fuel, fin, mar |
| `partner_name` | `NULL` | set (Bảo hiểm PVI, PVOIL Marine, HDBank, Petrolimex, …) |
| `cost` formula (line 3076) | `price × (0.62 + R()×0.24)` — true cost of goods | `price × (0.905 + R()×0.07)` — the partner's take; the residual is **platform commission**, ~2.5–9.5% |
| Sites | all 3 | first 2 only (`SITES.slice(0,2)`) |

`cost` therefore means two different things by `source`. Do not average or sum margin across the two without grouping by `source` — comment this at the column. `net` (`rev × margin / 100`, line 3105) is derived; make it a generated column.

Level-1 industry is denormalised onto `products.industry_code` (the prototype does the same via `G2L1[d[0]]`, line 3028) even though it is reachable through `group_code`. The 4-level tree (`prodNodes()`, line 3119) walks industry → group → base product line → listed product; level 3 is derived at render time by grouping on `base_name_vi`, so it needs no table.

A product is anchored to **either** a lane (ocean/feeder) **or** a site (everything else). Enforce:

```sql
CHECK ((lane_code IS NULL) <> (site_vi IS NULL))
CHECK ((source = 'out') = (partner_name IS NOT NULL))
```

The prototype's `p.name` getter (line 3102) concatenates base + lane/site + variant at render time — do **not** store a composite name column.

## Related Code Files

- Create: `package.json`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`
- Create: `db/schema/index.ts`, `db/schema/enums.ts`, `db/schema/reference.ts`, `db/schema/master.ts`
- Read: `docs/data-dictionary.md`, `ui-2.html`

## Implementation Steps

1. Initialise `package.json` with drizzle-orm, drizzle-kit, pg, tsx, typescript; add the four `db:*` scripts.
2. Write `tsconfig.json` (strict) and `drizzle.config.ts` pointing at `db/schema/index.ts` → `db/migrations`.
3. Write `db/schema/enums.ts` — `pgEnum` only for closed value sets with no bilingual label (e.g. `member_tier`, `licence_needed`, `ifrs9_stage`, `esg_grade`). Anything with a vi/en label becomes a reference table instead.
4. Write `db/schema/reference.ts` following the table above, in source order.
5. Write `db/schema/master.ts` — `members`, `fleet_assets`, `products`.
6. Add the `products` lane-xor-site CHECK, the partner-xor-null CHECK, the `products.net` and `fleet_assets.age` generated columns.
7. Add `created_at` / `updated_at` (`timestamptz` default `now()`) to every table.
8. Re-export everything from `db/schema/index.ts`.
9. Run `npx drizzle-kit generate` to confirm the schema compiles and produces DDL; do not apply yet (Phase 5 owns migrations).

## Success Criteria

- [x] `npx drizzle-kit generate` completes with no TypeScript or drizzle errors
- [x] All 43 reference tables and 3 master tables defined
- [x] Every bilingual label lives in exactly one reference table — grep confirms no `name_vi` on any transaction table
- [x] Every table has a comment citing its `ui-2.html` line range
- [x] `weight` columns present wherever the prototype used `pickw()`
- [x] No schema file exceeds 200 LOC
- [x] `products` CHECK constraint present and correct

## Risk Assessment

- **Over-normalisation.** Promoting every 3-value enum into a table adds joins for no gain. Rule applied here: reference table only when the value carries a bilingual label or a seed weight; otherwise `pgEnum`. Revisit any table that ends up with fewer than 3 rows and no label.
- **`status_labels` collision.** `ST_TAGS` reuses codes across domains (`open` means both "corridor open" and "RFQ open"; `docs` is both a KYB step and a doc type). Codes are globally unique in the prototype, so a single table is safe — but verify no two domains need the *same* code with *different* labels before locking it in.
- **`members.credit_limit` unit** is unresolved (open question 1). Do not write the column until Phase 1 settles it; a wrong unit propagates into exposures, applications, and every finance KPI.
