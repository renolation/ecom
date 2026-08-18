import {
  boolean, char, integer, numeric, pgTable, smallint, text, index,
} from 'drizzle-orm/pg-core'
import { timestamps } from './common'

/**
 * Shared status dictionary — ui-2.html:1091 (`ST_TAGS`).
 * ONE table for every domain's status codes. Verified: zero duplicate codes across
 * domains, so a single dictionary is safe and avoids ~15 per-domain label columns.
 * `tone` is the prototype's CSS tag class: u=good, d=bad, n=neutral, b=info, gd=warn, v=violet.
 */
export const statusLabels = pgTable('status_labels', {
  code: text('code').primaryKey(),
  tone: text('tone').notNull(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
})

/** ui-2.html:468 — the 6 personas. NOT an auth construct; this build has no auth. */
export const personas = pgTable('personas', {
  code: text('code').primaryKey(),
  icon: text('icon').notNull(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  orgVi: text('org_vi').notNull(),
  orgEn: text('org_en').notNull(),
  initials: text('initials').notNull(),
  homeRoute: text('home_route').notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/**
 * Platform capability modules F02–F15, referenced by nav items and the licence matrix.
 * Names are nullable: the prototype cites these codes as badges but never spells out
 * a title for them, and inventing one would put unsourced text in the database.
 */
export const modules = pgTable('modules', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi'),
  nameEn: text('name_en'),
  ...timestamps,
})

/** ui-2.html:489 — sidebar group headings, per persona. */
export const navGroups = pgTable('nav_groups', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  personaCode: text('persona_code').notNull().references(() => personas.code, { onDelete: 'restrict' }),
  ord: smallint('ord').notNull(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  ...timestamps,
}, (t) => [index('nav_groups_persona_idx').on(t.personaCode, t.ord)])

/**
 * ui-2.html:489 — sidebar entries. `badgeKey` names the count query the UI runs
 * (5 badges: rfq_closing, rfq_open, fleet_attention, kyb_pending, aml_high).
 */
export const navItems = pgTable('nav_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  groupId: integer('group_id').notNull().references(() => navGroups.id, { onDelete: 'cascade' }),
  ord: smallint('ord').notNull(),
  route: text('route').notNull(),
  icon: text('icon').notNull(),
  labelVi: text('label_vi').notNull(),
  labelEn: text('label_en').notNull(),
  moduleCode: text('module_code').references(() => modules.code, { onDelete: 'restrict' }),
  isAi: boolean('is_ai').notNull().default(false),
  isNew: boolean('is_new').notNull().default(false),
  badgeKey: text('badge_key'),
  ...timestamps,
}, (t) => [index('nav_items_group_idx').on(t.groupId, t.ord)])

/** ui-2.html:619 — SB-01…SB-08 regulatory sandbox programmes. */
export const sandboxPrograms = pgTable('sandbox_programs', {
  code: text('code').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  participantsVi: text('participants_vi').notNull(),
  participantsEn: text('participants_en').notNull(),
  featuresVi: text('features_vi').notNull(),
  featuresEn: text('features_en').notNull(),
  controlsVi: text('controls_vi').notNull(),
  controlsEn: text('controls_en').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  used: integer('used').notNull(),
  cap: integer('cap').notNull(),
  moduleCode: text('module_code').references(() => modules.code, { onDelete: 'restrict' }),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:575 — the 3 pilot corridors. gmv normalised to million VND (source uses tỷ). */
export const corridors = pgTable('corridors', {
  id: smallint('id').primaryKey(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  route: text('route').notNull(),
  useCaseVi: text('use_case_vi').notNull(),
  useCaseEn: text('use_case_en').notNull(),
  statusCode: text('status_code').notNull().references(() => statusLabels.code, { onDelete: 'restrict' }),
  suppliers: integer('suppliers').notNull(),
  shippers: integer('shippers').notNull(),
  teu: integer('teu').notNull(),
  gmvMVnd: numeric('gmv_m_vnd', { precision: 16, scale: 2 }).notNull(),
  quality: smallint('quality').notNull(),
  timeToQuote: numeric('time_to_quote', { precision: 6, scale: 2 }).notNull(),
  repeatRate: smallint('repeat_rate').notNull(),
  pl: numeric('pl', { precision: 8, scale: 2 }).notNull(),
  ...timestamps,
})

/** Derived from the origin/destination pairs in ui-2.html:565 (`LANES`). */
export const ports = pgTable('ports', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  countryCode: char('country_code', { length: 2 }).notNull(),
  isTranshipment: boolean('is_transhipment').notNull().default(false),
  ...timestamps,
})

/** ui-2.html:565 — 8 trade lanes. `indexPrice` is USD per 40' HC Dry. */
export const lanes = pgTable('lanes', {
  code: text('code').primaryKey(),
  originPortCode: text('origin_port_code').notNull().references(() => ports.code, { onDelete: 'restrict' }),
  destPortCode: text('dest_port_code').notNull().references(() => ports.code, { onDelete: 'restrict' }),
  indexPrice: numeric('index_price', { precision: 12, scale: 2 }).notNull(),
  changePct: numeric('change_pct', { precision: 6, scale: 2 }).notNull(),
  volumeTeu: integer('volume_teu').notNull(),
  transitDays: smallint('transit_days').notNull(),
  corridorId: smallint('corridor_id').notNull().references(() => corridors.id, { onDelete: 'restrict' }),
  ord: smallint('ord').notNull(),
  ...timestamps,
}, (t) => [index('lanes_corridor_idx').on(t.corridorId)])

/** ui-2.html:586 — 6 carriers. `color` is the prototype's brand swatch. */
export const carriers = pgTable('carriers', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  reliability: smallint('reliability').notNull(),
  co2Grade: char('co2_grade', { length: 1 }).notNull(),
  ord: smallint('ord').notNull(),
  ...timestamps,
})

/** ui-2.html:595 — the 7 governed AI sub-agents. tier 1=auto, 2=advisory, 3=human-only. */
export const aiAgents = pgTable('ai_agents', {
  id: smallint('id').primaryKey(),
  icon: text('icon').notNull(),
  nameVi: text('name_vi').notNull(),
  nameEn: text('name_en').notNull(),
  taskVi: text('task_vi').notNull(),
  taskEn: text('task_en').notNull(),
  controlVi: text('control_vi').notNull(),
  controlEn: text('control_en').notNull(),
  tier: smallint('tier').notNull(),
  runs: integer('runs').notNull(),
  accuracy: numeric('accuracy', { precision: 5, scale: 2 }).notNull(),
  overrideRate: numeric('override_rate', { precision: 5, scale: 2 }).notNull(),
  ...timestamps,
})
