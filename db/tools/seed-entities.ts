import type { Lookup } from './seed-reference'
import type { SqlValue } from './sql-writer'
import { insertRows, section } from './sql-writer'

type Ctx = Record<string, any>

interface Args {
  vi: Ctx
  lookups: Record<string, Lookup>
}

/** Resolves a Vietnamese label to its reference-table id, failing loudly on a miss. */
function fk(lookups: Record<string, Lookup>, table: string, label: string): number {
  const id = lookups[table]?.get(label)
  if (id === undefined) {
    throw new Error(`${table}: no reference row for "${label}" — reference build is out of sync`)
  }
  return id
}

/** document_types is keyed by a slugged English code, not by its Vietnamese label. */
function docTypeCode(lookups: Record<string, Lookup>, labelVi: string): string {
  const code = (lookups.__document_type_codes as unknown as Map<string, string>)?.get(labelVi)
  if (!code) throw new Error(`document_types: no code for "${labelVi}"`)
  return code
}

export function buildEntities({ vi, lookups }: Args): string {
  const parts: string[] = []
  const L = (t: string, v: string) => fk(lookups, t, v)

  // ---- members -----------------------------------------------------------
  parts.push(section('Master — members'))
  parts.push(
    insertRows(
      'members',
      ['id', 'name', 'type_code', 'sector_id', 'country_code', 'rating', 'score',
        'credit_limit_m_vnd', 'utilisation_pct', 'teu', 'gmv_m_vnd', 'kyb_status_code',
        'risk_level_code', 'compliance_status_code', 'tier', 'joined_on', 'wait_days',
        'corridor_id', 'active_30d', 'repeat_90d'],
      vi.MEMBERS.map((m: any): SqlValue[] => [
        m.id, m.n, m.ty, L('sectors', m.sec[0]), m.co, m.rate, m.score,
        m.limit, m.util, m.teu, m.gmv, m.kyb, m.risk, m.comp, m.tier, m.joined,
        m.wait, m.cor, m.act30, m.rep90,
      ]),
    ),
  )

  // ---- fleet -------------------------------------------------------------
  parts.push(section('Master — fleet assets'))
  parts.push(
    insertRows(
      'fleet_assets',
      ['id', 'asset_type_code', 'name', 'is_ship', 'capacity', 'capacity_unit', 'built_year',
        'flag', 'class_society', 'status_code', 'ownership_code', 'lane_code', 'corridor_id',
        'utilisation_pct', 'position', 'speed_knots', 'fuel', 'co2', 'cii_grade',
        'insurance_type', 'cert_days', 'maint_on', 'maint_due_days', 'opex', 'revenue',
        'asset_value', 'is_financed', 'dscr', 'crew', 'imo'],
      vi.FLEET.map((f: any): SqlValue[] => [
        f.id, f.ty, f.name, f.isShip, f.cap, f.unit, f.built, f.flag, f.cls, f.st, f.own,
        f.lane.c, f.cor, f.util, f.pos, f.speed, f.fuel, f.co2, f.cii, f.ins, f.certDays,
        f.maint, f.maintDue, f.opex, f.rev, f.value, f.fin, f.dscr, f.crew, f.imo,
      ]),
    ),
  )

  // ---- products ----------------------------------------------------------
  parts.push(section('Master — product catalogue (103 in-house SP- + 36 partner LK-)'))
  const bi = (v: any, i: 0 | 1): string => (Array.isArray(v) ? v[i] : String(v))
  parts.push(
    insertRows(
      'products',
      ['id', 'group_code', 'industry_code', 'source', 'partner_name', 'base_name_vi',
        'base_name_en', 'variant_vi', 'variant_en', 'lane_code', 'site_vi', 'site_en',
        'unit_vi', 'unit_en', 'periods_per_year', 'price', 'cost', 'margin_pct', 'index_ref',
        'capacity', 'sold', 'fill_pct', 'customers', 'revenue', 'trend', 'lifecycle_code',
        'attach_rate', 'sla', 'sla_hit', 'rating', 'status_code', 'corridor_id', 'is_bundle'],
      vi.PRODUCTS.map((p: any): SqlValue[] => [
        p.id, p.grp, p.l1, p.src, p.partner ?? null,
        bi(p.base, 0), bi(p.base, 1), bi(p.variant, 0), bi(p.variant, 1),
        p.lane ? p.lane.c : null,
        p.site ? bi(p.site, 0) : null, p.site ? bi(p.site, 1) : null,
        bi(p.unit0, 0), bi(p.unit0, 1), p.periods, p.price, p.cost, p.margin, p.idx,
        p.cap, p.sold, p.fill, p.cust, p.rev, p.trend, p.life, p.attach, p.sla, p.slaHit,
        p.rating, p.st, p.cor, p.bundle,
      ]),
    ),
  )

  // ---- trading -----------------------------------------------------------
  parts.push(section('Trading — offers, tenders, bids, rate cards, voyages'))
  parts.push(
    insertRows(
      'offers',
      ['lane_code', 'carrier_code', 'vessel', 'equipment_code', 'equipment_ord',
        'equipment_factor', 'price', 'base', 'thc', 'bunker', 'doc_fee', 'deviation_pct',
        'transit_days', 'is_direct', 'transhipment_port', 'depart_on', 'depart_offset',
        'slots_left', 'free_days', 'cutoff_days', 'validity_days', 'service_mode',
        'weekly_frequency', 'reliability', 'rating', 'co2', 'has_finance', 'has_insurance',
        'has_ebl', 'accepts_dg'],
      vi.OFFERS.map((o: any): SqlValue[] => [
        o.lane.c, vi.CARRIERS[o.car].s, o.ves, o.eq, o.eqi, o.ef,
        o.px, o.base, o.thc, o.bunker, o.doc, o.dev,
        o.tt, Boolean(o.dir), o.ts ?? null, o.dep, o.depN,
        o.left, o.free, o.cut, o.valid, o.svc, o.wk,
        o.rel, o.rating, o.co2, o.fin, o.ins, o.ebl, o.dg,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'rfqs',
      ['id', 'lane_code', 'scope_id', 'shipper_member_id', 'volume', 'bid_count', 'invited',
        'status_code', 'closes_in_days', 'index_price', 'best_price', 'saving_pct', 'value',
        'corridor_id'],
      vi.RFQS.map((q: any): SqlValue[] => [
        q.id, q.lane.c, L('rfq_scopes', q.scope[0]), memberIdByName(vi, q.shipper),
        q.vol, q.bids, q.inv, q.st, q.close, q.idx, q.best, q.save, q.val, q.cor,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'bids',
      ['rfq_id', 'carrier_code', 'lane_code', 'price', 'transit_days', 'validity', 'score',
        'allocation', 'status_code'],
      vi.BIDS.map((b: any): SqlValue[] => [
        b.rfq, vi.CARRIERS[b.car].s, b.lane.c, b.px, b.tt, b.val, b.score, b.alloc, b.st,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'rate_cards',
      ['lane_code', 'week', 'week_index', 'equipment_code', 'current_price', 'index_price',
        'suggested_price', 'capacity', 'sold', 'remaining', 'fill_pct', 'auto_pricing',
        'published', 'corridor_id', 'days_out'],
      vi.RATECARD.map((r: any): SqlValue[] => [
        r.lane.c, r.week, r.wi, r.eq, r.cur, r.idx, r.sug, r.cap, r.sold, r.left, r.fill,
        r.auto, r.pub, r.cor, r.days,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'voyages',
      ['id', 'vessel', 'lane_code', 'carrier_code', 'customer_member_id', 'eta', 'teu',
        'reefer_teu', 'share_of_wallet', 'service_basket', 'discount_pct', 'value',
        'status_code', 'corridor_id', 'confidence'],
      vi.VOYAGES.map((v: any): SqlValue[] => [
        v.id, v.ves, v.lane.c, vi.CARRIERS[v.car].s, memberIdByName(vi, v.cust), v.eta,
        v.teu, v.reefer, v.sow, v.basket, v.disc, v.val, v.st, v.cor, v.conf,
      ]),
    ),
  )

  // ---- operations --------------------------------------------------------
  parts.push(section('Operations — shipments, documents, disputes'))
  parts.push(
    insertRows(
      'shipments',
      ['id', 'lane_code', 'carrier_code', 'shipper_member_id', 'qty', 'status_ordinal',
        'etd', 'eta', 'value', 'cargo_value', 'vessel', 'risk_level', 'has_ebl',
        'has_insurance', 'has_finance', 'corridor_id', 'in_dispute', 'doc_count'],
      vi.SHIPS.map((s: any): SqlValue[] => [
        s.id, s.lane.c, vi.CARRIERS[s.car].s, s.shipperId, s.qty, s.st, s.etd, s.eta,
        s.val, s.cargo, s.ves, s.risk, s.ebl, s.ins, s.fin, s.cor, s.dispute, s.docs,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'documents',
      ['id', 'doc_type_code', 'shipment_id', 'shipper_member_id', 'issued_on', 'status_code',
        'signature_count', 'is_ebl', 'paper_fallback', 'corridor_id'],
      vi.DOCS.map((d: any): SqlValue[] => [
        d.ref, docTypeCode(lookups, d.ty[0]), d.ship, memberIdByName(vi, d.shipper), d.date,
        d.st, d.sigs, d.ebl, Boolean(d.fallback), d.cor,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'disputes',
      ['id', 'shipment_id', 'issue_type_id', 'evidence_source_id', 'value', 'tier',
        'status_code', 'days', 'claimant', 'respondent', 'auto_resolved', 'opened_on',
        'corridor_id'],
      vi.DISPUTES.map((d: any): SqlValue[] => [
        d.id, d.ship, L('dispute_issue_types', d.iss[0]), L('evidence_sources', d.src),
        d.val, d.tier, d.st, d.days, d.claimant, d.respondent, d.auto, d.date, d.cor,
      ]),
    ),
  )

  // ---- market index ------------------------------------------------------
  parts.push(section('Market — VLX index'))
  const anchor = new Date(Date.UTC(2026, 7, 15))
  const isoBack = (daysBefore: number) => {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() - daysBefore)
    return d.toISOString().slice(0, 10)
  }
  const series: number[] = vi.IDXSERIES
  parts.push(
    insertRows(
      'index_points',
      ['observed_on', 'value'],
      series.map((v, i): SqlValue[] => [isoBack(series.length - 1 - i), Number(v.toFixed(4))]),
    ),
  )
  const laneStats = Object.entries(vi.IDXLANE as Record<string, any>)
  parts.push(
    insertRows(
      'index_lane_stats',
      ['lane_code', 'level', 'd1', 'w1', 'm1', 'ytd', 'quality_grade', 'trades', 'providers'],
      laneStats.map(([code, s]): SqlValue[] => [
        code, s.lvl, s.d1, s.w1, s.m1, s.ytd, s.q, s.trades, s.prov,
      ]),
    ),
  )
  parts.push(
    insertRows(
      'index_lane_points',
      ['lane_code', 'seq', 'value'],
      laneStats.flatMap(([code, s]) =>
        (s.ser as number[]).map((v, i): SqlValue[] => [code, i, Number(v.toFixed(4))]),
      ),
    ),
  )

  return parts.join('\n')
}

/**
 * The prototype stores a member's display name on several transaction rows but only
 * carries the id on shipments. Names are unique across MEMBERS (duplicates get a
 * suffix at generation time), so name → id is a safe resolution.
 */
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
