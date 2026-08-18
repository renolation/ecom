CREATE TYPE "public"."decision_right" AS ENUM('y', 'n', 'p');--> statement-breakpoint
CREATE TYPE "public"."finance_structure" AS ENUM('term', 'lease', 'proj');--> statement-breakpoint
CREATE TYPE "public"."grade_letter" AS ENUM('A', 'B', 'C', 'D', 'E');--> statement-breakpoint
CREATE TYPE "public"."ifrs9_stage" AS ENUM('s1', 's2', 's3');--> statement-breakpoint
CREATE TYPE "public"."insurance_cover" AS ENUM('hm', 'pi', 'cargo', 'none');--> statement-breakpoint
CREATE TYPE "public"."licence_needed" AS ENUM('n', 'p', 'y');--> statement-breakpoint
CREATE TYPE "public"."member_tier" AS ENUM('direct', 'clearing', 'broker', 'data');--> statement-breakpoint
CREATE TYPE "public"."supply_source" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" smallint PRIMARY KEY NOT NULL,
	"icon" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"task_vi" text NOT NULL,
	"task_en" text NOT NULL,
	"control_vi" text NOT NULL,
	"control_en" text NOT NULL,
	"tier" smallint NOT NULL,
	"runs" integer NOT NULL,
	"accuracy" numeric(5, 2) NOT NULL,
	"override_rate" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"reliability" smallint NOT NULL,
	"co2_grade" char(1) NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corridors" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"route" text NOT NULL,
	"use_case_vi" text NOT NULL,
	"use_case_en" text NOT NULL,
	"status_code" text NOT NULL,
	"suppliers" integer NOT NULL,
	"shippers" integer NOT NULL,
	"teu" integer NOT NULL,
	"gmv_m_vnd" numeric(16, 2) NOT NULL,
	"quality" smallint NOT NULL,
	"time_to_quote" numeric(6, 2) NOT NULL,
	"repeat_rate" smallint NOT NULL,
	"pl" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lanes" (
	"code" text PRIMARY KEY NOT NULL,
	"origin_port_code" text NOT NULL,
	"dest_port_code" text NOT NULL,
	"index_price" numeric(12, 2) NOT NULL,
	"change_pct" numeric(6, 2) NOT NULL,
	"volume_teu" integer NOT NULL,
	"transit_days" smallint NOT NULL,
	"corridor_id" smallint NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text,
	"name_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nav_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"persona_code" text NOT NULL,
	"ord" smallint NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nav_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer NOT NULL,
	"ord" smallint NOT NULL,
	"route" text NOT NULL,
	"icon" text NOT NULL,
	"label_vi" text NOT NULL,
	"label_en" text NOT NULL,
	"module_code" text,
	"is_ai" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"badge_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"code" text PRIMARY KEY NOT NULL,
	"icon" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"org_vi" text NOT NULL,
	"org_en" text NOT NULL,
	"initials" text NOT NULL,
	"home_route" text NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"is_transhipment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_programs" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"participants_vi" text NOT NULL,
	"participants_en" text NOT NULL,
	"features_vi" text NOT NULL,
	"features_en" text NOT NULL,
	"controls_vi" text NOT NULL,
	"controls_en" text NOT NULL,
	"status_code" text NOT NULL,
	"used" integer NOT NULL,
	"cap" integer NOT NULL,
	"module_code" text,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_labels" (
	"code" text PRIMARY KEY NOT NULL,
	"tone" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abuse_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aml_alert_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_finance_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"structure" "finance_structure" NOT NULL,
	"weight" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdp_nba_actions" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdp_segments" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collateral_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodity_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_issue_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint NOT NULL,
	"is_ebl" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_types" (
	"code" text PRIMARY KEY NOT NULL,
	"ord" smallint NOT NULL,
	"teu_factor" numeric(6, 3) NOT NULL,
	"capacity_factor" numeric(6, 3) NOT NULL,
	"weight" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_products" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"module_code" text,
	"weight" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_steps" (
	"ordinal" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lc_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"share_pct" smallint NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_scopes" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_modes" (
	"code" text PRIMARY KEY NOT NULL,
	"weight" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_triggers" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_statuses" (
	"ordinal" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"icon" text NOT NULL,
	"seed_count" smallint NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"target_vi" text NOT NULL,
	"target_en" text NOT NULL,
	"budget" numeric(10, 2) NOT NULL,
	"used" numeric(10, 2) NOT NULL,
	"activated" smallint NOT NULL,
	"repeat_rate" smallint NOT NULL,
	"cpa" numeric(10, 2) NOT NULL,
	"status_code" text NOT NULL,
	"rule_vi" text NOT NULL,
	"rule_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_purposes" (
	"id" smallint PRIMARY KEY NOT NULL,
	"purpose_vi" text NOT NULL,
	"purpose_en" text NOT NULL,
	"counterparty" text NOT NULL,
	"data_scope_vi" text NOT NULL,
	"data_scope_en" text NOT NULL,
	"legal_basis_vi" text NOT NULL,
	"legal_basis_en" text NOT NULL,
	"retention_months" smallint,
	"revocable" boolean NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_rights" (
	"id" smallint PRIMARY KEY NOT NULL,
	"matter_vi" text NOT NULL,
	"matter_en" text NOT NULL,
	"platform" "decision_right" NOT NULL,
	"provider" "decision_right" NOT NULL,
	"bank" "decision_right" NOT NULL,
	"insurer" "decision_right" NOT NULL,
	"regulator" "decision_right" NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet_statuses" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licence_matrix" (
	"id" smallint PRIMARY KEY NOT NULL,
	"service_vi" text NOT NULL,
	"service_en" text NOT NULL,
	"responsible_vi" text NOT NULL,
	"responsible_en" text NOT NULL,
	"platform_role_vi" text NOT NULL,
	"platform_role_en" text NOT NULL,
	"licence_needed" "licence_needed" NOT NULL,
	"module_codes" text,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_stages" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_groups" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"icon" text NOT NULL,
	"industry_code" text NOT NULL,
	"source" "supply_source" NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_industries" (
	"code" text PRIMARY KEY NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"icon" text NOT NULL,
	"source" "supply_source" NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_statuses" (
	"code" text PRIMARY KEY NOT NULL,
	"tone" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_type_code" text NOT NULL,
	"name" text NOT NULL,
	"is_ship" boolean NOT NULL,
	"capacity" integer NOT NULL,
	"capacity_unit" text NOT NULL,
	"built_year" smallint NOT NULL,
	"age" smallint GENERATED ALWAYS AS (2026 - built_year) STORED,
	"flag" text NOT NULL,
	"class_society" text NOT NULL,
	"status_code" text NOT NULL,
	"ownership_code" text NOT NULL,
	"lane_code" text NOT NULL,
	"corridor_id" smallint NOT NULL,
	"utilisation_pct" smallint NOT NULL,
	"position" text NOT NULL,
	"speed_knots" numeric(5, 1) NOT NULL,
	"fuel" numeric(7, 1) NOT NULL,
	"co2" integer NOT NULL,
	"cii_grade" text NOT NULL,
	"insurance_type" "insurance_cover" NOT NULL,
	"cert_days" smallint NOT NULL,
	"maint_on" date NOT NULL,
	"maint_due_days" smallint NOT NULL,
	"opex" numeric(12, 2) NOT NULL,
	"revenue" numeric(12, 2) NOT NULL,
	"asset_value" numeric(12, 2) NOT NULL,
	"is_financed" boolean NOT NULL,
	"dscr" numeric(5, 2) NOT NULL,
	"crew" smallint NOT NULL,
	"imo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type_code" text NOT NULL,
	"sector_id" smallint NOT NULL,
	"country_code" char(2) NOT NULL,
	"rating" text NOT NULL,
	"score" smallint NOT NULL,
	"credit_limit_m_vnd" numeric(16, 2) NOT NULL,
	"utilisation_pct" smallint NOT NULL,
	"teu" integer NOT NULL,
	"gmv_m_vnd" numeric(16, 2) NOT NULL,
	"kyb_status_code" text NOT NULL,
	"risk_level_code" text NOT NULL,
	"compliance_status_code" text NOT NULL,
	"tier" "member_tier" NOT NULL,
	"joined_on" date NOT NULL,
	"wait_days" smallint NOT NULL,
	"corridor_id" smallint NOT NULL,
	"active_30d" boolean NOT NULL,
	"repeat_90d" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_score_range" CHECK ("members"."score" BETWEEN 0 AND 100),
	CONSTRAINT "members_util_range" CHECK ("members"."utilisation_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"group_code" text NOT NULL,
	"industry_code" text NOT NULL,
	"source" "supply_source" NOT NULL,
	"partner_name" text,
	"base_name_vi" text NOT NULL,
	"base_name_en" text NOT NULL,
	"variant_vi" text NOT NULL,
	"variant_en" text NOT NULL,
	"lane_code" text,
	"site_vi" text,
	"site_en" text,
	"unit_vi" text NOT NULL,
	"unit_en" text NOT NULL,
	"periods_per_year" smallint NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"margin_pct" numeric(6, 2) NOT NULL,
	"index_ref" numeric(14, 2) NOT NULL,
	"capacity" integer NOT NULL,
	"sold" integer NOT NULL,
	"fill_pct" smallint NOT NULL,
	"customers" smallint NOT NULL,
	"revenue" numeric(16, 2) NOT NULL,
	"net" numeric(16, 2) GENERATED ALWAYS AS (round(revenue * margin_pct / 100, 2)) STORED,
	"trend" smallint NOT NULL,
	"lifecycle_code" text NOT NULL,
	"attach_rate" smallint NOT NULL,
	"sla" smallint NOT NULL,
	"sla_hit" smallint NOT NULL,
	"rating" numeric(3, 1) NOT NULL,
	"status_code" text NOT NULL,
	"corridor_id" smallint NOT NULL,
	"is_bundle" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_lane_xor_site" CHECK (("products"."lane_code" IS NULL) <> ("products"."site_vi" IS NULL)),
	CONSTRAINT "products_partner_matches_source" CHECK (("products"."source" = 'out') = ("products"."partner_name" IS NOT NULL)),
	CONSTRAINT "products_sold_within_capacity" CHECK ("products"."sold" <= "products"."capacity"),
	CONSTRAINT "products_cost_below_price" CHECK ("products"."cost" < "products"."price")
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bids_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rfq_id" text NOT NULL,
	"carrier_code" text NOT NULL,
	"lane_code" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"transit_days" smallint NOT NULL,
	"validity" smallint NOT NULL,
	"score" smallint NOT NULL,
	"allocation" text NOT NULL,
	"status_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_score_range" CHECK ("bids"."score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "offers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lane_code" text NOT NULL,
	"carrier_code" text NOT NULL,
	"vessel" text NOT NULL,
	"equipment_code" text NOT NULL,
	"equipment_ord" smallint NOT NULL,
	"equipment_factor" numeric(6, 3) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"base" numeric(12, 2) NOT NULL,
	"thc" numeric(12, 2) NOT NULL,
	"bunker" numeric(12, 2) NOT NULL,
	"doc_fee" numeric(12, 2) NOT NULL,
	"deviation_pct" numeric(7, 3) NOT NULL,
	"transit_days" smallint NOT NULL,
	"is_direct" boolean NOT NULL,
	"transhipment_port" text,
	"depart_on" date NOT NULL,
	"depart_offset" smallint NOT NULL,
	"slots_left" smallint NOT NULL,
	"free_days" smallint NOT NULL,
	"cutoff_days" smallint NOT NULL,
	"validity_days" smallint NOT NULL,
	"service_mode" text NOT NULL,
	"weekly_frequency" smallint NOT NULL,
	"reliability" smallint NOT NULL,
	"rating" numeric(3, 1) NOT NULL,
	"co2" integer NOT NULL,
	"has_finance" boolean NOT NULL,
	"has_insurance" boolean NOT NULL,
	"has_ebl" boolean NOT NULL,
	"accepts_dg" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_direct_xor_transhipment" CHECK ("offers"."is_direct" = ("offers"."transhipment_port" IS NULL)),
	CONSTRAINT "offers_reliability_range" CHECK ("offers"."reliability" BETWEEN 70 AND 99)
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lane_code" text NOT NULL,
	"week" text NOT NULL,
	"week_index" smallint NOT NULL,
	"equipment_code" text NOT NULL,
	"current_price" numeric(12, 2) NOT NULL,
	"index_price" numeric(12, 2) NOT NULL,
	"suggested_price" numeric(12, 2) NOT NULL,
	"capacity" integer NOT NULL,
	"sold" integer NOT NULL,
	"remaining" integer NOT NULL,
	"fill_pct" smallint NOT NULL,
	"auto_pricing" boolean NOT NULL,
	"published" boolean NOT NULL,
	"corridor_id" smallint NOT NULL,
	"days_out" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_cards_sold_within_capacity" CHECK ("rate_cards"."sold" <= "rate_cards"."capacity"),
	CONSTRAINT "rate_cards_remaining_identity" CHECK ("rate_cards"."remaining" = "rate_cards"."capacity" - "rate_cards"."sold"),
	CONSTRAINT "rate_cards_fill_range" CHECK ("rate_cards"."fill_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_code" text NOT NULL,
	"scope_id" smallint NOT NULL,
	"shipper_member_id" text NOT NULL,
	"volume" integer NOT NULL,
	"bid_count" smallint NOT NULL,
	"invited" smallint NOT NULL,
	"status_code" text NOT NULL,
	"closes_in_days" smallint NOT NULL,
	"index_price" numeric(12, 2) NOT NULL,
	"best_price" numeric(12, 2) NOT NULL,
	"saving_pct" numeric(6, 2) NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voyages" (
	"id" text PRIMARY KEY NOT NULL,
	"vessel" text NOT NULL,
	"lane_code" text NOT NULL,
	"carrier_code" text NOT NULL,
	"customer_member_id" text NOT NULL,
	"eta" date NOT NULL,
	"teu" integer NOT NULL,
	"reefer_teu" integer NOT NULL,
	"share_of_wallet" smallint NOT NULL,
	"service_basket" jsonb NOT NULL,
	"discount_pct" numeric(5, 1) NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"status_code" text NOT NULL,
	"corridor_id" smallint NOT NULL,
	"confidence" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"issue_type_id" smallint NOT NULL,
	"evidence_source_id" smallint NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"tier" smallint NOT NULL,
	"status_code" text NOT NULL,
	"days" numeric(6, 1) NOT NULL,
	"claimant" text NOT NULL,
	"respondent" text NOT NULL,
	"auto_resolved" boolean NOT NULL,
	"opened_on" date NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_tier_range" CHECK ("disputes"."tier" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_type_code" text NOT NULL,
	"shipment_id" text NOT NULL,
	"shipper_member_id" text NOT NULL,
	"issued_on" date NOT NULL,
	"status_code" text NOT NULL,
	"signature_count" smallint NOT NULL,
	"is_ebl" boolean NOT NULL,
	"paper_fallback" boolean NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_fallback_only_ebl" CHECK (NOT "documents"."paper_fallback" OR "documents"."is_ebl")
);
--> statement-breakpoint
CREATE TABLE "index_lane_points" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "index_lane_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lane_code" text NOT NULL,
	"seq" smallint NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_lane_stats" (
	"lane_code" text PRIMARY KEY NOT NULL,
	"level" numeric(12, 2) NOT NULL,
	"d1" numeric(7, 2) NOT NULL,
	"w1" numeric(7, 2) NOT NULL,
	"m1" numeric(7, 2) NOT NULL,
	"ytd" numeric(7, 2) NOT NULL,
	"quality_grade" text NOT NULL,
	"trades" smallint NOT NULL,
	"providers" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_points" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "index_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"observed_on" date NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "index_points_observed_on_unique" UNIQUE("observed_on")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_code" text NOT NULL,
	"carrier_code" text NOT NULL,
	"shipper_member_id" text NOT NULL,
	"qty" smallint NOT NULL,
	"status_ordinal" smallint NOT NULL,
	"etd" date NOT NULL,
	"eta" date NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"cargo_value" numeric(18, 2) NOT NULL,
	"vessel" text NOT NULL,
	"risk_level" smallint NOT NULL,
	"has_ebl" boolean NOT NULL,
	"has_insurance" boolean NOT NULL,
	"has_finance" boolean NOT NULL,
	"corridor_id" smallint NOT NULL,
	"in_dispute" boolean NOT NULL,
	"doc_count" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_qty_positive" CHECK ("shipments"."qty" > 0),
	CONSTRAINT "shipments_eta_after_etd" CHECK ("shipments"."eta" >= "shipments"."etd"),
	CONSTRAINT "shipments_risk_range" CHECK ("shipments"."risk_level" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE TABLE "asset_finance_deals" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_finance_type_id" smallint NOT NULL,
	"member_id" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"ltv" smallint NOT NULL,
	"term_years" smallint NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"status_code" text NOT NULL,
	"irr" numeric(5, 2) NOT NULL,
	"dscr" numeric(5, 2) NOT NULL,
	"collateral_type_id" smallint NOT NULL,
	"esg_grade" text NOT NULL,
	"originated_on" date NOT NULL,
	"bank" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_finance_ltv_range" CHECK ("asset_finance_deals"."ltv" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "credit_exposures" (
	"member_id" text PRIMARY KEY NOT NULL,
	"exposure" numeric(16, 2) NOT NULL,
	"ifrs9_stage" "ifrs9_stage" NOT NULL,
	"collateral" numeric(16, 2) NOT NULL,
	"ecl" numeric(16, 4) NOT NULL,
	"days_past_due" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"product_code" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"score" smallint NOT NULL,
	"decision_code" text NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"pd" numeric(6, 2) NOT NULL,
	"turnaround_hours" numeric(6, 1) NOT NULL,
	"auto_decided" boolean NOT NULL,
	"applied_on" date NOT NULL,
	"bank" text NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letters_of_credit" (
	"id" text PRIMARY KEY NOT NULL,
	"lc_type_id" smallint NOT NULL,
	"applicant_member_id" text NOT NULL,
	"beneficiary" text NOT NULL,
	"bank" text NOT NULL,
	"shipment_id" text NOT NULL,
	"lane_code" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"step_ordinal" smallint NOT NULL,
	"discrepancies" smallint NOT NULL,
	"opened_on" date NOT NULL,
	"expires_on" date NOT NULL,
	"turnaround_hours" numeric(6, 1) NOT NULL,
	"doc_count" smallint NOT NULL,
	"auto_checked" boolean NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"counterparty" text NOT NULL,
	"carrier" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"trigger_id" smallint NOT NULL,
	"status_code" text NOT NULL,
	"is_matched" boolean NOT NULL,
	"settled_on" date NOT NULL,
	"payment_ref" text NOT NULL,
	"bank" text NOT NULL,
	"early_payment" boolean NOT NULL,
	"corridor_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abuse_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"abuse_type_id" smallint NOT NULL,
	"member_id" text NOT NULL,
	"campaign_id" smallint NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status_code" text NOT NULL,
	"flagged_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" smallint NOT NULL,
	"action_id" smallint NOT NULL,
	"tier" smallint NOT NULL,
	"outcome_code" text NOT NULL,
	"confidence" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"run_on" date DEFAULT '2026-08-15' NOT NULL,
	"run_at" time NOT NULL,
	"approver" text NOT NULL,
	"model" text NOT NULL,
	"shipment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_tier_range" CHECK ("agent_runs"."tier" BETWEEN 1 AND 3),
	CONSTRAINT "agent_runs_confidence_range" CHECK ("agent_runs"."confidence" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "aml_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_type_id" smallint NOT NULL,
	"member_id" text NOT NULL,
	"severity_code" text NOT NULL,
	"status_code" text NOT NULL,
	"raised_on" date NOT NULL,
	"score" smallint NOT NULL,
	"agent_flagged" boolean NOT NULL,
	"tier" smallint NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aml_tier_range" CHECK ("aml_alerts"."tier" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "consent_grants" (
	"member_id" text NOT NULL,
	"purpose_id" smallint NOT NULL,
	"granted" boolean NOT NULL,
	"revocable" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdp_accounts" (
	"member_id" text PRIMARY KEY NOT NULL,
	"segment_id" smallint NOT NULL,
	"share_of_wallet" smallint NOT NULL,
	"revenue" numeric(16, 2) NOT NULL,
	"trend" smallint NOT NULL,
	"churn_risk_code" text NOT NULL,
	"source_count" smallint NOT NULL,
	"confidence" smallint NOT NULL,
	"is_merged" boolean NOT NULL,
	"services" jsonb NOT NULL,
	"nba_action_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdp_merge_queue" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cdp_merge_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"golden_name" text NOT NULL,
	"confidence" smallint NOT NULL,
	"tax_id_masked" text NOT NULL,
	"status_code" text NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdp_merge_records" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cdp_merge_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"queue_id" bigint NOT NULL,
	"source_record" text NOT NULL,
	"ord" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_origin_port_code_ports_code_fk" FOREIGN KEY ("origin_port_code") REFERENCES "public"."ports"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_dest_port_code_ports_code_fk" FOREIGN KEY ("dest_port_code") REFERENCES "public"."ports"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_groups" ADD CONSTRAINT "nav_groups_persona_code_personas_code_fk" FOREIGN KEY ("persona_code") REFERENCES "public"."personas"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_group_id_nav_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."nav_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_module_code_modules_code_fk" FOREIGN KEY ("module_code") REFERENCES "public"."modules"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_programs" ADD CONSTRAINT "sandbox_programs_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_programs" ADD CONSTRAINT "sandbox_programs_module_code_modules_code_fk" FOREIGN KEY ("module_code") REFERENCES "public"."modules"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_products" ADD CONSTRAINT "finance_products_module_code_modules_code_fk" FOREIGN KEY ("module_code") REFERENCES "public"."modules"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_industry_code_product_industries_code_fk" FOREIGN KEY ("industry_code") REFERENCES "public"."product_industries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assets" ADD CONSTRAINT "fleet_assets_asset_type_code_asset_types_code_fk" FOREIGN KEY ("asset_type_code") REFERENCES "public"."asset_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assets" ADD CONSTRAINT "fleet_assets_status_code_fleet_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."fleet_statuses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assets" ADD CONSTRAINT "fleet_assets_ownership_code_ownership_types_code_fk" FOREIGN KEY ("ownership_code") REFERENCES "public"."ownership_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assets" ADD CONSTRAINT "fleet_assets_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_assets" ADD CONSTRAINT "fleet_assets_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_type_code_member_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "public"."member_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_kyb_status_code_status_labels_code_fk" FOREIGN KEY ("kyb_status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_risk_level_code_status_labels_code_fk" FOREIGN KEY ("risk_level_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_compliance_status_code_status_labels_code_fk" FOREIGN KEY ("compliance_status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_group_code_product_groups_code_fk" FOREIGN KEY ("group_code") REFERENCES "public"."product_groups"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_industry_code_product_industries_code_fk" FOREIGN KEY ("industry_code") REFERENCES "public"."product_industries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_lifecycle_code_lifecycle_stages_code_fk" FOREIGN KEY ("lifecycle_code") REFERENCES "public"."lifecycle_stages"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_status_code_product_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."product_statuses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_carrier_code_carriers_code_fk" FOREIGN KEY ("carrier_code") REFERENCES "public"."carriers"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_carrier_code_carriers_code_fk" FOREIGN KEY ("carrier_code") REFERENCES "public"."carriers"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_equipment_code_equipment_types_code_fk" FOREIGN KEY ("equipment_code") REFERENCES "public"."equipment_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_service_mode_service_modes_code_fk" FOREIGN KEY ("service_mode") REFERENCES "public"."service_modes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_equipment_code_equipment_types_code_fk" FOREIGN KEY ("equipment_code") REFERENCES "public"."equipment_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_scope_id_rfq_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."rfq_scopes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_shipper_member_id_members_id_fk" FOREIGN KEY ("shipper_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_carrier_code_carriers_code_fk" FOREIGN KEY ("carrier_code") REFERENCES "public"."carriers"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_customer_member_id_members_id_fk" FOREIGN KEY ("customer_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_issue_type_id_dispute_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."dispute_issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_evidence_source_id_evidence_sources_id_fk" FOREIGN KEY ("evidence_source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_doc_type_code_document_types_code_fk" FOREIGN KEY ("doc_type_code") REFERENCES "public"."document_types"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_shipper_member_id_members_id_fk" FOREIGN KEY ("shipper_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_lane_points" ADD CONSTRAINT "index_lane_points_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_lane_stats" ADD CONSTRAINT "index_lane_stats_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_code_carriers_code_fk" FOREIGN KEY ("carrier_code") REFERENCES "public"."carriers"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipper_member_id_members_id_fk" FOREIGN KEY ("shipper_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_status_ordinal_shipment_statuses_ordinal_fk" FOREIGN KEY ("status_ordinal") REFERENCES "public"."shipment_statuses"("ordinal") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_finance_deals" ADD CONSTRAINT "asset_finance_deals_asset_finance_type_id_asset_finance_types_id_fk" FOREIGN KEY ("asset_finance_type_id") REFERENCES "public"."asset_finance_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_finance_deals" ADD CONSTRAINT "asset_finance_deals_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_finance_deals" ADD CONSTRAINT "asset_finance_deals_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_finance_deals" ADD CONSTRAINT "asset_finance_deals_collateral_type_id_collateral_types_id_fk" FOREIGN KEY ("collateral_type_id") REFERENCES "public"."collateral_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_exposures" ADD CONSTRAINT "credit_exposures_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_product_code_finance_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."finance_products"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_decision_code_status_labels_code_fk" FOREIGN KEY ("decision_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_lc_type_id_lc_types_id_fk" FOREIGN KEY ("lc_type_id") REFERENCES "public"."lc_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_applicant_member_id_members_id_fk" FOREIGN KEY ("applicant_member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_lane_code_lanes_code_fk" FOREIGN KEY ("lane_code") REFERENCES "public"."lanes"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_step_ordinal_lc_steps_ordinal_fk" FOREIGN KEY ("step_ordinal") REFERENCES "public"."lc_steps"("ordinal") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters_of_credit" ADD CONSTRAINT "letters_of_credit_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trigger_id_settlement_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."settlement_triggers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_abuse_type_id_abuse_types_id_fk" FOREIGN KEY ("abuse_type_id") REFERENCES "public"."abuse_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_action_id_agent_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_outcome_code_status_labels_code_fk" FOREIGN KEY ("outcome_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_alert_type_id_aml_alert_types_id_fk" FOREIGN KEY ("alert_type_id") REFERENCES "public"."aml_alert_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_severity_code_status_labels_code_fk" FOREIGN KEY ("severity_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_purpose_id_consent_purposes_id_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."consent_purposes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_accounts" ADD CONSTRAINT "cdp_accounts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_accounts" ADD CONSTRAINT "cdp_accounts_segment_id_cdp_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."cdp_segments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_accounts" ADD CONSTRAINT "cdp_accounts_churn_risk_code_status_labels_code_fk" FOREIGN KEY ("churn_risk_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_accounts" ADD CONSTRAINT "cdp_accounts_nba_action_id_cdp_nba_actions_id_fk" FOREIGN KEY ("nba_action_id") REFERENCES "public"."cdp_nba_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_merge_queue" ADD CONSTRAINT "cdp_merge_queue_status_code_status_labels_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."status_labels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdp_merge_records" ADD CONSTRAINT "cdp_merge_records_queue_id_cdp_merge_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."cdp_merge_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lanes_corridor_idx" ON "lanes" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "nav_groups_persona_idx" ON "nav_groups" USING btree ("persona_code","ord");--> statement-breakpoint
CREATE INDEX "nav_items_group_idx" ON "nav_items" USING btree ("group_id","ord");--> statement-breakpoint
CREATE INDEX "fleet_attention_idx" ON "fleet_assets" USING btree ("cert_days","maint_due_days");--> statement-breakpoint
CREATE INDEX "fleet_status_idx" ON "fleet_assets" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "fleet_corridor_idx" ON "fleet_assets" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "members_kyb_idx" ON "members" USING btree ("kyb_status_code");--> statement-breakpoint
CREATE INDEX "members_type_idx" ON "members" USING btree ("type_code");--> statement-breakpoint
CREATE INDEX "members_corridor_idx" ON "members" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "products_group_idx" ON "products" USING btree ("group_code");--> statement-breakpoint
CREATE INDEX "products_industry_idx" ON "products" USING btree ("industry_code");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "products_corridor_idx" ON "products" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "bids_rfq_idx" ON "bids" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "bids_carrier_idx" ON "bids" USING btree ("carrier_code");--> statement-breakpoint
CREATE INDEX "offers_lane_idx" ON "offers" USING btree ("lane_code");--> statement-breakpoint
CREATE INDEX "offers_carrier_idx" ON "offers" USING btree ("carrier_code");--> statement-breakpoint
CREATE INDEX "offers_equipment_idx" ON "offers" USING btree ("equipment_code");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_cards_grid_uq" ON "rate_cards" USING btree ("lane_code","week","equipment_code");--> statement-breakpoint
CREATE INDEX "rate_cards_heatmap_idx" ON "rate_cards" USING btree ("lane_code","week_index","equipment_code");--> statement-breakpoint
CREATE INDEX "rate_cards_corridor_idx" ON "rate_cards" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "rfqs_status_closing_idx" ON "rfqs" USING btree ("status_code","closes_in_days");--> statement-breakpoint
CREATE INDEX "rfqs_lane_idx" ON "rfqs" USING btree ("lane_code");--> statement-breakpoint
CREATE INDEX "rfqs_shipper_idx" ON "rfqs" USING btree ("shipper_member_id");--> statement-breakpoint
CREATE INDEX "rfqs_corridor_idx" ON "rfqs" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "voyages_lane_idx" ON "voyages" USING btree ("lane_code");--> statement-breakpoint
CREATE INDEX "voyages_carrier_idx" ON "voyages" USING btree ("carrier_code");--> statement-breakpoint
CREATE INDEX "voyages_status_idx" ON "voyages" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "disputes_shipment_idx" ON "disputes" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "disputes_corridor_idx" ON "disputes" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "documents_shipment_idx" ON "documents" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("doc_type_code");--> statement-breakpoint
CREATE INDEX "documents_corridor_idx" ON "documents" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "index_lane_points_lane_seq_idx" ON "index_lane_points" USING btree ("lane_code","seq");--> statement-breakpoint
CREATE INDEX "index_points_date_idx" ON "index_points" USING btree ("observed_on");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status_ordinal");--> statement-breakpoint
CREATE INDEX "shipments_lane_idx" ON "shipments" USING btree ("lane_code");--> statement-breakpoint
CREATE INDEX "shipments_carrier_idx" ON "shipments" USING btree ("carrier_code");--> statement-breakpoint
CREATE INDEX "shipments_shipper_idx" ON "shipments" USING btree ("shipper_member_id");--> statement-breakpoint
CREATE INDEX "shipments_corridor_idx" ON "shipments" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "asset_finance_member_idx" ON "asset_finance_deals" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "asset_finance_status_idx" ON "asset_finance_deals" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "exposures_stage_idx" ON "credit_exposures" USING btree ("ifrs9_stage");--> statement-breakpoint
CREATE INDEX "finapps_member_idx" ON "finance_applications" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "finapps_decision_idx" ON "finance_applications" USING btree ("decision_code");--> statement-breakpoint
CREATE INDEX "finapps_corridor_idx" ON "finance_applications" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "lcs_applicant_idx" ON "letters_of_credit" USING btree ("applicant_member_id");--> statement-breakpoint
CREATE INDEX "lcs_shipment_idx" ON "letters_of_credit" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "lcs_step_idx" ON "letters_of_credit" USING btree ("step_ordinal");--> statement-breakpoint
CREATE INDEX "lcs_corridor_idx" ON "letters_of_credit" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "settlements_status_idx" ON "settlements" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "settlements_shipment_idx" ON "settlements" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "settlements_corridor_idx" ON "settlements" USING btree ("corridor_id");--> statement-breakpoint
CREATE INDEX "abuse_member_idx" ON "abuse_flags" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "abuse_campaign_idx" ON "abuse_flags" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_runs_outcome_idx" ON "agent_runs" USING btree ("outcome_code");--> statement-breakpoint
CREATE INDEX "agent_runs_shipment_idx" ON "agent_runs" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "aml_severity_status_idx" ON "aml_alerts" USING btree ("severity_code","status_code");--> statement-breakpoint
CREATE INDEX "aml_member_idx" ON "aml_alerts" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_grants_uq" ON "consent_grants" USING btree ("member_id","purpose_id");--> statement-breakpoint
CREATE INDEX "cdp_segment_idx" ON "cdp_accounts" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "cdp_churn_idx" ON "cdp_accounts" USING btree ("churn_risk_code");--> statement-breakpoint
CREATE INDEX "cdp_merge_records_queue_idx" ON "cdp_merge_records" USING btree ("queue_id","ord");