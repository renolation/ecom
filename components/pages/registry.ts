import type { RoutePage } from './page-props'
import {
  CarrierSettlementPage, FleetPage,
} from './carrier-assets'
import { ProductPage } from './carrier-product'
import {
  BidInboxPage, CapacityRatesPage, CarrierDashboardPage, VoyageOfferingPage,
} from './carrier-supply'
import {
  ConsentPage, DocumentsPage, LetterOfCreditPage, ShipmentsPage, WalletPage,
} from './shipper-operations'
import {
  AmlPage, DisputePage, MembersPage,
} from './exchange-compliance'
import {
  CampaignPage, ClearingPage, CorridorPage, IndexPage,
} from './exchange-market'
import {
  AssetFinancePage, CreditEnginePage, FinanceDashboardPage, FinanceProductPage, RiskPage,
} from './finance'
import {
  AgentGovernancePage, CdpActivationPage, CdpUnifiedPage, LicencePage, NeutralityPage,
  SandboxPage,
} from './governance'
import { MarketPage, RfqPage } from './shipper-trading'

/**
 * Route → page component. Anything absent falls through to the placeholder in
 * `app/r/[route]/page.tsx`, so the sidebar always resolves while porting continues.
 */
export const PAGES: Record<string, RoutePage> = {
  // Shipper / BCO
  s_market: MarketPage,
  s_rfq: RfqPage,
  s_ship: ShipmentsPage,
  s_docs: DocumentsPage,
  s_fin: WalletPage,
  s_lc: LetterOfCreditPage,
  s_consent: ConsentPage,

  // Carrier / service provider
  c_dash: CarrierDashboardPage,
  c_inv: CapacityRatesPage,
  c_offer: VoyageOfferingPage,
  c_bids: BidInboxPage,
  c_fleet: FleetPage,
  c_product: ProductPage,
  c_settle: CarrierSettlementPage,

  // Platform operations
  x_index: IndexPage,
  x_corridor: CorridorPage,
  x_mem: MembersPage,
  x_aml: AmlPage,
  x_disp: DisputePage,
  x_campaign: CampaignPage,
  x_clear: ClearingPage,

  // Financial institution
  f_dash: FinanceDashboardPage,
  f_credit: CreditEnginePage,
  f_prod: FinanceProductPage,
  f_asset: AssetFinancePage,
  f_risk: RiskPage,

  // Regulator
  r_sandbox: SandboxPage,
  r_license: LicencePage,

  // AI governance and platform neutrality (shared by regulator and CDP)
  a_agents: AgentGovernancePage,
  a_gov: NeutralityPage,

  // CDP 360
  cdp_360: CdpUnifiedPage,
  cdp_act: CdpActivationPage,
}
