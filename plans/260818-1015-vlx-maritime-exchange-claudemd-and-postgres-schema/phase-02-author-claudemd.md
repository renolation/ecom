---
phase: 2
title: "Author CLAUDE.md"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Author CLAUDE.md

## Overview

Write the repo-root `CLAUDE.md` so a cold session can work on this codebase without reading 546KB of `ui-2.html`. Also write `docs/system-architecture.md` with the module map and ERD.

## Requirements

**Functional**
- Domain glossary: VLX, VMFB, BCO, eB/L, L/C, UPAS, TEU, VGM, corridor, lane, sandbox (SB-01…SB-08), module codes (F02–F15), KYB, UBO, STR, AML, SCF, CDP, NBA, DSCR, CII, ECL, IFRS-9 staging.
- Stack and commands: Next.js App Router, Postgres 17, Drizzle, `db:generate` / `db:migrate` / `db:seed`.
- Directory map matching the layout in `plan.md`.
- DB conventions: snake_case, bilingual `*_vi`/`*_en` on reference tables only, business-ref text PKs, `status_labels` shared dictionary, date anchor 2026-08-15.
- **Explicit no-auth statement** and its consequence (R1): the prototype's data-boundary notices are presentational; nothing enforces member scoping. This is an accepted decision for the demo build — state it as a known property, not a warning to act on. Note that all data is synthetic and that `member_id` FKs are retained so scoping can be added later.
- Pointer to `ui-2.html` as source of truth and `docs/data-dictionary.md` as the field-level contract.

**Non-functional**
- Concise. Under 200 lines. It is an instruction file, not a manual — link out rather than inline.
- No invented conventions. Everything traceable to `ui-2.html`, this plan, or the user's stated stack.

## Architecture

`CLAUDE.md` sections, in order:

1. **Project** — what VLX is, in three sentences; the six personas and what each does.
2. **Stack and commands** — runnable commands only.
3. **Repository layout** — the tree.
4. **Domain glossary** — highest-value section for a cold session.
5. **Database conventions** — naming, bilingual strategy, PK strategy, date anchor, seed determinism.
6. **Constraints** — no auth (accepted for demo, R1); seed keeps real company names against synthetic compliance data (accepted, validation session 1); `ui-2.html` is read-only source of truth; scope is DB + docs, not app.
7. **Where to look** — the `ui-2.html` line-anchor table (reuse the one in `plan.md`) and `docs/data-dictionary.md`.

Respect the user's global rules already in force: docs live in `docs/`, plans in `plans/`, YAGNI/KISS/DRY, modularise code files over 200 LOC (Markdown exempt).

### Persona reference (from `NAV`, lines 489–564)

| Persona | Code | Routes |
|---|---|---|
| Shipper / BCO | `shipper` | home, market, rfq, shipments, docs, wallet/escrow, digital L/C, consent |
| Carrier / provider | `carrier` | home, dashboard, capacity+rates, voyage offering assistant, bid inbox, transport asset 360, product 360, reconciliation |
| Platform operations | `exchange` | ops console, VLX index, corridors+P&L, members+KYB, AML, 3-tier disputes, campaigns+anti-abuse, clearing |
| Financial institution | `finance` | home, logistics financial center, credit decision engine, financing+insurance, asset finance+data room, risk+portfolio |
| Regulator / supervisor | `regulator` | supervisory dashboard, sandbox matrix, licence matrix, AI agent governance, neutrality+data |
| CDP member | `cdp` | home, unified customers, activation+NBA, data walls |

## Related Code Files

- Create: `CLAUDE.md`
- Create: `docs/system-architecture.md`
- Read: `docs/data-dictionary.md` (Phase 1), `ui-2.html`

## Implementation Steps

1. Draft the domain glossary from Phase 1's dictionary — the section that pays for the file.
2. Write the persona table (above) with each persona's route set.
3. Write stack, commands, and layout sections.
4. Write DB conventions, mirroring the Locked Decisions table in `plan.md`.
5. Write the constraints section; state the no-auth consequence in plain terms.
6. Write `docs/system-architecture.md`: module map (F02–F15 → tables), Mermaid `erDiagram`, and the six domain groupings from `plan.md`.
7. Verify every claim against source; delete anything unverifiable.

## Success Criteria

- [x] `CLAUDE.md` at repo root, under 200 lines
- [x] Glossary covers every acronym appearing in `ui-2.html` page titles and nav labels
- [x] All six personas documented with their route sets
- [x] No-auth constraint stated explicitly as an accepted demo property
- [x] Money-unit convention (`*_m_vnd`, million VND) documented
- [x] Commands listed are runnable as written (re-verified after Phase 6)
- [x] `docs/system-architecture.md` has a Mermaid ERD covering all domain groups
- [x] A reader who has not opened `ui-2.html` can explain "corridor", "lane", and "sandbox programme" after reading it

## Risk Assessment

- **Writing CLAUDE.md before the schema exists** risks documenting conventions Phase 3/4 then violate. Mitigation: revisit the DB-conventions and commands sections at the end of Phase 6; treat both as provisional until then.
- **Bloat.** A 600-line CLAUDE.md gets skimmed and ignored. Keep under 200 lines; push detail into `docs/`.
