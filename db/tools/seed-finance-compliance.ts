import type { Lookup } from './seed-reference'
import type { SqlValue } from './sql-writer'
import { insertRows, insertRowsOverriding, section } from './sql-writer'

type Ctx = Record<string, any>

interface Args {
  vi: Ctx
  lookups: Record<string, Lookup>
}

function fk(lookups: Record<string, Lookup>, table: string, label: string): number {
  const id = lookups[table]?.get(label)
  if (id === undefined) {
    throw new Error(`${table}: no reference row for "${label}" — reference build is out of sync`)
  }
  return id
}

export function buildFinanceCompliance({ vi, lookups }: Args): string {
  const parts: string[] = []
  const L = (t: string, v: string) => fk(lookups, t, v)

  parts.push(section('Finance — L/C, applications, exposures, settlements, asset finance'))
  parts.push(
    insertRows(
      'letters_of_credit',
      ['id', 'lc_type_id', 'applicant_member_id', 'beneficiary', 'bank', 'shipment_id',
        'lane_code', 'amount', 'step_ordinal', 'discrepancies', 'opened_on', 'expires_on',
        'turnaround_hours', 'doc_count', 'auto_checked', 'corridor_id'],
      vi.LCS.map((l: any): SqlValue[] => [
        l.id, L('lc_types', l.ty[0]), memberIdByName(vi, l.app), l.ben, l.bank, l.ship,
        l.lane.c, l.amt, l.st, l.disc, l.open, l.exp, l.tat, l.docs, l.auto, l.cor,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'finance_applications',
      ['id', 'member_id', 'product_code', 'amount', 'score', 'decision_code', 'rate', 'pd',
        'turnaround_hours', 'auto_decided', 'applied_on', 'bank', 'corridor_id'],
      vi.FINAPPS.map((a: any): SqlValue[] => [
        a.id, a.m.id, a.prod[0], a.amt, a.score, a.dec, a.rate, a.pd, a.tat, a.auto,
        a.date, a.bank, a.cor,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'credit_exposures',
      ['member_id', 'exposure', 'ifrs9_stage', 'collateral', 'ecl', 'days_past_due'],
      vi.EXPOS.map((e: any): SqlValue[] => [
        e.m.id, e.exp, e.stage, e.coll, e.ecl, e.dpd,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'settlements',
      ['id', 'shipment_id', 'counterparty', 'carrier', 'amount', 'trigger_id', 'status_code',
        'is_matched', 'settled_on', 'payment_ref', 'bank', 'early_payment', 'corridor_id'],
      vi.SETTLES.map((s: any): SqlValue[] => [
        s.id, s.ship, s.cp, s.car, s.amt, L('settlement_triggers', s.trig), s.st, s.match,
        s.date, s.ref, s.bank, s.early, s.cor,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'asset_finance_deals',
      ['id', 'asset_finance_type_id', 'member_id', 'amount', 'ltv', 'term_years', 'rate',
        'status_code', 'irr', 'dscr', 'collateral_type_id', 'esg_grade', 'originated_on', 'bank'],
      vi.ASSETS.map((a: any): SqlValue[] => [
        a.id, L('asset_finance_types', a.ty[0]), a.m.id, a.amt, a.ltv, a.term, a.rate,
        a.st, a.irr, a.dscr, L('collateral_types', a.coll), a.esg, a.date, a.bank,
      ]),
    ),
  )

  parts.push(section('Compliance — AML, abuse, agent runs, consent'))
  parts.push(
    insertRows(
      'aml_alerts',
      ['id', 'alert_type_id', 'member_id', 'severity_code', 'status_code', 'raised_on',
        'score', 'agent_flagged', 'tier', 'value'],
      vi.AMLALERTS.map((a: any): SqlValue[] => [
        a.id, L('aml_alert_types', a.ty[0]), a.m.id, a.sev, a.st, a.date, a.score,
        a.agent, a.tier, a.val,
      ]),
    ),
  )
  const campaignIdByName = new Map<string, number>(
    vi.CAMPAIGNS.map((c: any, i: number) => [Array.isArray(c.n) ? c.n[0] : String(c.n), i + 1]),
  )
  parts.push(
    insertRows(
      'abuse_flags',
      ['id', 'abuse_type_id', 'member_id', 'campaign_id', 'amount', 'status_code', 'flagged_on'],
      vi.ABUSE.map((a: any): SqlValue[] => {
        const campName = Array.isArray(a.camp.n) ? a.camp.n[0] : String(a.camp.n)
        const campId = campaignIdByName.get(campName)
        if (!campId) throw new Error(`campaigns: no row named "${campName}"`)
        return [a.id, L('abuse_types', a.ty[0]), a.m.id, campId, a.amt, a.st, a.date]
      }),
    ),
  )
  const agentIdByNameVi = new Map<string, number>(
    vi.AGENTS.map((a: any, i: number) => [a.n(), i + 1]),
  )
  parts.push(
    insertRows(
      'agent_runs',
      ['id', 'agent_id', 'action_id', 'tier', 'outcome_code', 'confidence', 'duration_ms',
        'run_at', 'approver', 'model', 'shipment_id'],
      vi.AGENTRUNS.map((r: any): SqlValue[] => {
        const agentId = agentIdByNameVi.get(r.ag.n())
        if (!agentId) throw new Error(`ai_agents: no row named "${r.ag.n()}"`)
        return [
          r.id, agentId, L('agent_actions', r.act[0]), r.tier, r.outc, r.conf, r.ms,
          r.ts, r.approver, r.model, r.obj,
        ]
      }),
    ),
  )

  // The prototype models consent for the signed-in shipper only; MEMBERS[0] stands in.
  const demoMemberId = vi.MEMBERS[0].id
  parts.push(
    insertRows(
      'consent_grants',
      ['member_id', 'purpose_id', 'granted', 'revocable'],
      vi.CONSENTS.map((c: any, i: number): SqlValue[] => [
        demoMemberId, i + 1, Boolean(c.on), Boolean(c.rev),
      ]),
    ),
  )

  parts.push(section('CDP — unified customers and identity resolution'))
  parts.push(
    insertRows(
      'cdp_accounts',
      ['member_id', 'segment_id', 'share_of_wallet', 'revenue', 'trend', 'churn_risk_code',
        'source_count', 'confidence', 'is_merged', 'services', 'nba_action_id'],
      vi.CDPACC.map((a: any): SqlValue[] => [
        a.m.id, L('cdp_segments', a.seg[0]), a.sow, a.rev, a.trend, a.churn, a.src,
        a.conf, a.merged, a.svc, L('cdp_nba_actions', a.nba[0]),
      ]),
    ),
  )
  parts.push(
    insertRowsOverriding(
      'cdp_merge_queue',
      ['id', 'golden_name', 'confidence', 'tax_id_masked', 'status_code', 'ord'],
      vi.MERGEQ.map((q: any, i: number): SqlValue[] => [
        i + 1, q.n, q.conf, q.mst, q.st, i,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'cdp_merge_records',
      ['queue_id', 'source_record', 'ord'],
      vi.MERGEQ.flatMap((q: any, qi: number) =>
        (q.recs as string[]).map((rec, i): SqlValue[] => [qi + 1, rec, i]),
      ),
    ),
  )

  return parts.join('\n')
}

let nameIndex: Map<string, string> | null = null
function memberIdByName(vi: Ctx, name: string): string {
  if (!nameIndex) {
    nameIndex = new Map()
    for (const m of vi.MEMBERS) if (!nameIndex.has(m.n)) nameIndex.set(m.n, m.id)
  }
  const id = nameIndex.get(name)
  if (!id) throw new Error(`members: no row named "${name}"`)
  return id
}
