import type { CareerId, CityId, IndustryId } from '../../src/core/types.ts';

/**
 * The fictional demo employers. None of these names belongs to a real company.
 * Several (Peachtree Brands, Magnolia Media Group, Larkspur Consumer Co.,
 * Northwind Capital, Halcyon Advisory) are referenced by other agents' fixtures
 * and must keep their exact names.
 */
export interface CompanySpec {
  slug: string;
  name: string;
  industry: IndustryId;
  /** Continues the sentence "<name> ...". */
  blurb: string;
  /** City mix with weights; the first entry is the HQ. */
  cities: [CityId, number][];
  /** Career mix with weights. */
  careers: [CareerId, number][];
  /** Relative size inside its industry. */
  weight: number;
  /** Fixed number of current postings (overrides the size weight). */
  fixedCount?: number;
  /** No current postings at all (last-cycle history only). */
  noCurrent?: boolean;
  /** Hourly pay offset in dollars. */
  payBias?: number;
  /** Number of postings with a deadline 2-5 days from today. */
  earlyDeadlines?: number;
  /** Groups to favour per career. */
  prefer?: Partial<Record<string, string[]>>;
  /** Signals that are very likely required, per career. */
  boost?: Partial<Record<string, string[]>>;
  /** Non-business internships (software engineering, data science, design). */
  nonBusiness?: number;
  /** Last cycle's roles all opened inside this window (ISO dates, inclusive). */
  lastOpenWindow?: [string, string];
  /** This cycle's roles were posted and already closed (no live postings). */
  closedThisCycle?: number;
}

const nyc: CityId = 'nyc';

export const COMPANIES: CompanySpec[] = [
  // ---------------- finance (16) ----------------
  {
    slug: 'northwind-capital', name: 'Northwind Capital', industry: 'finance', weight: 5, payBias: 2, earlyDeadlines: 4,
    blurb: 'is a New York investment bank that advises companies and sponsors on mergers, financings and trading.',
    cities: [[nyc, 85], ['chicago', 8], ['sf-bay', 7]],
    careers: [['investment-banking', 40], ['sales-trading', 34], ['asset-management', 6], ['corporate-finance', 6], ['business-analytics', 5], ['operations', 5], ['people-hr', 2], ['sales', 2]],
  },
  {
    slug: 'brightwater-securities', name: 'Brightwater Securities', industry: 'finance', weight: 4,
    blurb: 'is a securities firm with trading floors in New York and Chicago and a growing remote analytics team.',
    cities: [[nyc, 50], ['chicago', 35], ['remote', 15]],
    careers: [['sales-trading', 40], ['investment-banking', 20], ['business-analytics', 14], ['corporate-finance', 10], ['operations', 10], ['asset-management', 6]],
  },
  {
    slug: 'copperfield-rowe', name: 'Copperfield & Rowe', industry: 'finance', weight: 3, payBias: 1,
    blurb: 'is a boutique advisory bank focused on mid-sized company sales and restructurings.',
    cities: [[nyc, 100]],
    careers: [['investment-banking', 70], ['corporate-finance', 10], ['business-analytics', 10], ['operations', 10]],
  },
  {
    slug: 'ardent-lane-partners', name: 'Ardent Lane Partners', industry: 'finance', weight: 3,
    blurb: 'is an advisory and capital markets firm serving growth companies and private equity sponsors.',
    cities: [[nyc, 60], ['boston', 40]],
    careers: [['investment-banking', 55], ['asset-management', 15], ['corporate-finance', 10], ['business-analytics', 10], ['people-hr', 5], ['operations', 5]],
  },
  {
    slug: 'lakeshore-fiduciary', name: 'Lakeshore Fiduciary Group', industry: 'finance', weight: 3,
    blurb: 'is a Chicago money manager overseeing retirement and endowment portfolios.',
    cities: [['chicago', 85], [nyc, 8], ['remote', 7]],
    careers: [['asset-management', 55], ['business-analytics', 15], ['corporate-finance', 10], ['operations', 10], ['sales', 5], ['people-hr', 5]],
  },
  {
    slug: 'lantern-point-bancorp', name: 'Lantern Point Bancorp', industry: 'finance', weight: 3,
    blurb: 'is a regional bank holding company with commercial, consumer and wealth businesses across the Southeast.',
    cities: [['charlotte', 60], ['atlanta', 35], ['remote', 5]],
    careers: [['corporate-finance', 28], ['investment-banking', 20], ['business-analytics', 14], ['operations', 14], ['sales', 10], ['marketing', 8], ['people-hr', 6]],
  },
  {
    slug: 'redwood-quay', name: 'Redwood Quay Asset Management', industry: 'finance', weight: 3,
    blurb: 'is an investment manager with offices in San Francisco and New York and a distributed research group.',
    cities: [['sf-bay', 50], [nyc, 30], ['remote', 20]],
    careers: [['asset-management', 55], ['business-analytics', 15], ['corporate-finance', 10], ['operations', 8], ['marketing', 6], ['people-hr', 6]],
  },
  {
    slug: 'hollis-grey', name: 'Hollis Grey & Co.', industry: 'finance', weight: 2.5,
    blurb: 'is an independent investment bank known for its work with healthcare and technology companies.',
    cities: [[nyc, 90], ['boston', 10]],
    careers: [['investment-banking', 65], ['sales-trading', 10], ['corporate-finance', 10], ['business-analytics', 8], ['operations', 7]],
  },
  {
    slug: 'summit-harbor-financial', name: 'Summit Harbor Financial', industry: 'finance', weight: 3,
    blurb: 'is a Texas-based financial group with energy lending, wealth management and trading businesses.',
    cities: [['dallas', 50], ['houston', 45], ['austin', 5]],
    careers: [['investment-banking', 30], ['asset-management', 20], ['sales-trading', 15], ['corporate-finance', 15], ['business-analytics', 10], ['operations', 10]],
  },
  {
    slug: 'ironvale-credit', name: 'Ironvale Credit Partners', industry: 'finance', weight: 2,
    blurb: 'is a credit investor that lends to middle-market companies and manages private debt funds.',
    cities: [[nyc, 100]],
    careers: [['asset-management', 50], ['investment-banking', 20], ['corporate-finance', 12], ['business-analytics', 10], ['operations', 8]],
  },
  {
    slug: 'quillon-equity', name: 'Quillon Equity Partners', industry: 'finance', weight: 2.5,
    blurb: 'is a private equity firm that buys and builds industrial and consumer businesses.',
    cities: [[nyc, 65], ['chicago', 35]],
    careers: [['asset-management', 45], ['investment-banking', 25], ['corporate-finance', 12], ['business-analytics', 10], ['people-hr', 8]],
  },
  {
    slug: 'calloway-trust', name: 'Calloway Trust Company', industry: 'finance', weight: 2,
    blurb: 'is a Boston trust and wealth company serving families, foundations and institutions.',
    cities: [['boston', 90], [nyc, 10]],
    careers: [['asset-management', 50], ['corporate-finance', 15], ['business-analytics', 12], ['sales', 10], ['operations', 8], ['marketing', 5]],
  },
  {
    slug: 'marlowe-brandt', name: 'Marlowe Brandt Securities', industry: 'finance', weight: 1, noCurrent: true, closedThisCycle: 6,
    blurb: 'is a small broker-dealer that filled its summer class early this year.',
    cities: [[nyc, 70], ['sf-bay', 30]],
    careers: [['sales-trading', 50], ['investment-banking', 30], ['operations', 20]],
  },
  {
    slug: 'oakhaven-wealth', name: 'Oakhaven Wealth Advisors', industry: 'finance', weight: 2.5,
    blurb: 'is a wealth advisory firm with offices across the Southeast and Florida.',
    cities: [['atlanta', 40], ['charlotte', 30], ['miami', 30]],
    careers: [['asset-management', 40], ['sales', 20], ['marketing', 12], ['corporate-finance', 10], ['business-analytics', 10], ['people-hr', 8]],
  },
  {
    slug: 'veridian-markets', name: 'Veridian Markets', industry: 'finance', weight: 3,
    blurb: 'is a market maker and trading firm with desks in Chicago and New York and a remote quantitative team.',
    cities: [['chicago', 45], [nyc, 25], ['remote', 30]],
    careers: [['sales-trading', 40], ['business-analytics', 22], ['corporate-finance', 12], ['operations', 14], ['asset-management', 12]],
  },
  {
    slug: 'harborlight-bank', name: 'Harborlight Bank & Trust', industry: 'finance', weight: 3,
    blurb: 'is a mid-Atlantic bank serving individuals, small businesses and public institutions.',
    cities: [['philadelphia', 45], ['dc', 25], [nyc, 25], ['remote', 5]],
    careers: [['corporate-finance', 25], ['investment-banking', 15], ['business-analytics', 15], ['operations', 15], ['sales', 12], ['marketing', 8], ['people-hr', 10]],
  },

  // ---------------- consulting (8) ----------------
  {
    slug: 'halcyon-advisory', name: 'Halcyon Advisory', industry: 'consulting', weight: 1, fixedCount: 8, earlyDeadlines: 2,
    lastOpenWindow: ['2025-10-19', '2025-10-19'],
    blurb: 'is a management consulting firm that helps leadership teams make operating and growth decisions.',
    cities: [[nyc, 50], ['chicago', 30], ['boston', 20]],
    careers: [['strategy', 40], ['business-analytics', 35], ['people-hr', 15], ['operations', 10]],
  },
  {
    slug: 'orchard-vale', name: 'Orchard & Vale Consulting', industry: 'consulting', weight: 3,
    blurb: 'is a generalist consulting firm with practices in healthcare, consumer and financial services.',
    cities: [[nyc, 45], ['chicago', 30], ['atlanta', 25]],
    careers: [['consulting', 65], ['strategy', 12], ['business-analytics', 12], ['people-hr', 5], ['operations', 6]],
  },
  {
    slug: 'fenwick-strategy', name: 'Fenwick Strategy Group', industry: 'consulting', weight: 1, noCurrent: true, lastOpenWindow: ['2025-10-20', '2025-10-20'],
    blurb: 'is a strategy consultancy that runs one summer class each year.',
    cities: [['boston', 60], [nyc, 40]],
    careers: [['consulting', 60], ['strategy', 40]],
  },
  {
    slug: 'alderbrook-partners', name: 'Alderbrook Partners', industry: 'consulting', weight: 2.5,
    blurb: 'is a consulting firm focused on technology, public sector and operations work.',
    cities: [['chicago', 40], ['sf-bay', 30], ['dc', 30]],
    careers: [['consulting', 60], ['strategy', 15], ['business-analytics', 15], ['operations', 10]],
  },
  {
    slug: 'tamarind-group', name: 'Tamarind Group', industry: 'consulting', weight: 1.5,
    blurb: 'is an Atlanta-born consulting group working with retailers, manufacturers and logistics companies.',
    cities: [['atlanta', 60], ['dallas', 40]],
    careers: [['consulting', 55], ['operations', 15], ['business-analytics', 15], ['strategy', 15]],
  },
  {
    slug: 'westerly-pryce', name: 'Westerly & Pryce', industry: 'consulting', weight: 2,
    blurb: 'is an advisory firm serving banks, insurers and government agencies.',
    cities: [[nyc, 65], ['dc', 35]],
    careers: [['consulting', 60], ['strategy', 15], ['business-analytics', 15], ['people-hr', 10]],
  },
  {
    slug: 'sparrow-hill', name: 'Sparrow Hill Consulting', industry: 'consulting', weight: 1.5,
    blurb: 'is a remote-first consultancy that staffs project teams across the country.',
    cities: [['remote', 70], ['dc', 20], [nyc, 10]],
    careers: [['consulting', 50], ['business-analytics', 25], ['strategy', 15], ['people-hr', 10]],
  },
  {
    slug: 'cobalt-fern', name: 'Cobalt & Fern', industry: 'consulting', weight: 2,
    blurb: 'is a West Coast consulting firm focused on technology, media and consumer clients.',
    cities: [['sf-bay', 40], ['los-angeles', 35], ['seattle', 25]],
    careers: [['consulting', 55], ['strategy', 20], ['business-analytics', 15], ['marketing', 10]],
  },

  // ---------------- accounting (5) ----------------
  {
    slug: 'whitlock-ames', name: 'Whitlock Ames LLP', industry: 'accounting', weight: 4,
    blurb: 'is an accounting and advisory firm offering audit, tax and consulting services to public and private companies.',
    cities: [[nyc, 30], ['chicago', 25], ['atlanta', 25], ['dallas', 20]],
    careers: [['accounting', 82], ['business-analytics', 8], ['consulting', 5], ['people-hr', 5]],
  },
  {
    slug: 'barrow-keane', name: 'Barrow Keane & Associates', industry: 'accounting', weight: 3,
    blurb: 'is a mid-sized accounting firm with strong tax and transaction advisory practices.',
    cities: [['boston', 40], [nyc, 35], ['philadelphia', 25]],
    careers: [['accounting', 80], ['business-analytics', 10], ['corporate-finance', 10]],
  },
  {
    slug: 'dunmore-hale', name: 'Dunmore Hale LLP', industry: 'accounting', weight: 1, noCurrent: true, lastOpenWindow: ['2025-10-22', '2025-10-22'],
    blurb: 'is a regional accounting firm that opens its summer audit and tax class in the fall.',
    cities: [['charlotte', 45], ['atlanta', 35], ['miami', 20]],
    careers: [['accounting', 100]],
  },
  {
    slug: 'pemberton-voss', name: 'Pemberton Voss CPAs', industry: 'accounting', weight: 2.5,
    blurb: 'is a certified public accounting firm serving family businesses and mid-market companies.',
    cities: [['chicago', 40], ['denver', 30], ['houston', 30]],
    careers: [['accounting', 85], ['business-analytics', 8], ['people-hr', 7]],
  },
  {
    slug: 'tallis-corwin', name: 'Tallis Corwin Advisory', industry: 'accounting', weight: 2.5,
    blurb: 'is a West Coast accounting and risk advisory firm for technology and media companies.',
    cities: [['los-angeles', 40], ['sf-bay', 35], ['seattle', 25]],
    careers: [['accounting', 80], ['business-analytics', 10], ['consulting', 10]],
  },

  // ---------------- technology (12) ----------------
  {
    slug: 'lumenpath', name: 'Lumenpath Software', industry: 'technology', weight: 3, nonBusiness: 14,
    blurb: 'builds workflow software used by finance and operations teams at mid-sized companies.',
    cities: [['sf-bay', 50], [nyc, 25], ['remote', 25]],
    careers: [['product-management', 25], ['business-analytics', 20], ['sales', 20], ['marketing', 15], ['operations', 10], ['people-hr', 10]],
  },
  {
    slug: 'quartzwave', name: 'Quartzwave Systems', industry: 'technology', weight: 3, nonBusiness: 12,
    blurb: 'makes cloud infrastructure tools for engineering teams.',
    cities: [['seattle', 55], ['austin', 30], ['remote', 15]],
    careers: [['product-management', 25], ['sales', 22], ['business-analytics', 20], ['marketing', 13], ['corporate-finance', 10], ['strategy', 10]],
  },
  {
    slug: 'nimbus-forge', name: 'Nimbus Forge', industry: 'technology', weight: 2.5, nonBusiness: 10,
    blurb: 'is a developer platform company with a mostly remote workforce.',
    cities: [['remote', 55], ['austin', 25], ['denver', 20]],
    careers: [['product-management', 28], ['marketing', 20], ['sales', 20], ['business-analytics', 15], ['operations', 10], ['people-hr', 7]],
  },
  {
    slug: 'pixelharbor', name: 'Pixelharbor Labs', industry: 'technology', weight: 2.5, nonBusiness: 12,
    blurb: 'builds creative software for photo and video teams.',
    cities: [['sf-bay', 55], ['los-angeles', 35], ['remote', 10]],
    careers: [['product-management', 25], ['marketing', 28], ['business-analytics', 15], ['sales', 15], ['strategy', 10], ['operations', 7]],
  },
  {
    slug: 'gridstone-cloud', name: 'Gridstone Cloud', industry: 'technology', weight: 2.5, nonBusiness: 10,
    blurb: 'sells data storage and security services to large enterprises.',
    cities: [['seattle', 50], ['remote', 30], [nyc, 20]],
    careers: [['sales', 28], ['product-management', 20], ['business-analytics', 20], ['marketing', 12], ['corporate-finance', 10], ['operations', 10]],
  },
  {
    slug: 'cinderline', name: 'Cinderline Data', industry: 'technology', weight: 2.5, nonBusiness: 10,
    blurb: 'provides analytics software to banks, insurers and retailers.',
    cities: [[nyc, 50], ['boston', 35], ['remote', 15]],
    careers: [['business-analytics', 30], ['product-management', 22], ['sales', 20], ['strategy', 10], ['marketing', 10], ['people-hr', 8]],
  },
  {
    slug: 'brightloop', name: 'Brightloop', industry: 'technology', weight: 2.5, nonBusiness: 10,
    blurb: 'is an Atlanta financial technology company that makes payment and billing tools.',
    cities: [['atlanta', 60], ['remote', 25], [nyc, 15]],
    careers: [['product-management', 22], ['sales', 22], ['business-analytics', 18], ['marketing', 14], ['corporate-finance', 12], ['operations', 12]],
  },
  {
    slug: 'tessellate', name: 'Tessellate Technologies', industry: 'technology', weight: 2, nonBusiness: 8,
    blurb: 'is a technology services firm that builds software for federal and state agencies.',
    cities: [['dc', 60], [nyc, 20], ['remote', 20]],
    careers: [['business-analytics', 28], ['operations', 22], ['strategy', 15], ['product-management', 15], ['sales', 10], ['people-hr', 10]],
  },
  {
    slug: 'orbitrail', name: 'Orbitrail', industry: 'technology', weight: 2, nonBusiness: 10,
    blurb: 'builds scheduling and routing software for delivery fleets.',
    cities: [['sf-bay', 45], ['austin', 40], ['remote', 15]],
    careers: [['product-management', 28], ['operations', 22], ['business-analytics', 20], ['sales', 15], ['marketing', 15]],
  },
  {
    slug: 'kestrel-wire', name: 'Kestrel Wire', industry: 'technology', weight: 2, nonBusiness: 8,
    blurb: 'makes connected sensors and the software that reads them.',
    cities: [['chicago', 55], ['remote', 30], ['denver', 15]],
    careers: [['operations', 25], ['product-management', 22], ['sales', 20], ['business-analytics', 18], ['strategy', 8], ['people-hr', 7]],
  },
  {
    slug: 'mosaic-ledger', name: 'Mosaic Ledger', industry: 'technology', weight: 2.5, nonBusiness: 8,
    blurb: 'is a payments company that helps online businesses accept and reconcile payments.',
    cities: [[nyc, 55], ['atlanta', 30], ['remote', 15]],
    careers: [['product-management', 22], ['corporate-finance', 20], ['business-analytics', 20], ['sales', 15], ['marketing', 13], ['operations', 10]],
  },
  {
    slug: 'paperkite', name: 'Paperkite', industry: 'technology', weight: 2, nonBusiness: 8,
    blurb: 'builds collaboration tools for small teams and runs a fully remote company.',
    cities: [['remote', 70], ['denver', 30]],
    careers: [['marketing', 28], ['product-management', 22], ['sales', 20], ['business-analytics', 15], ['people-hr', 15]],
  },

  // ---------------- consumer (10) ----------------
  {
    slug: 'peachtree-brands', name: 'Peachtree Brands', industry: 'consumer', weight: 4, earlyDeadlines: 3,
    blurb: 'is an Atlanta consumer goods company behind household food, beverage and home care brands.',
    cities: [['atlanta', 82], [nyc, 6], ['charlotte', 6], ['remote', 6]],
    careers: [['marketing', 56], ['sales', 8], ['supply-chain', 8], ['business-analytics', 8], ['corporate-finance', 6], ['operations', 6], ['people-hr', 4], ['strategy', 4]],
    prefer: { marketing: ['Brand', 'Shopper', 'Consumer Insights', 'Trade', 'Product', 'Digital'] },
  },
  {
    slug: 'larkspur-consumer', name: 'Larkspur Consumer Co.', industry: 'consumer', weight: 4,
    blurb: 'is a lifestyle and personal care company that sells through stores and social-first channels.',
    cities: [['atlanta', 50], [nyc, 45], ['remote', 5]],
    careers: [['marketing', 56], ['sales', 10], ['supply-chain', 6], ['business-analytics', 10], ['corporate-finance', 6], ['product-management', 6], ['people-hr', 6]],
    prefer: { marketing: ['Social Media', 'Influencer & Community', 'Content', 'Digital', 'Creative'] },
    boost: { marketing: ['social-media'] },
  },
  {
    slug: 'juniper-hearth', name: 'Juniper & Hearth', industry: 'consumer', weight: 3,
    blurb: 'is a Chicago home goods brand with its own stores and an online shop.',
    cities: [['chicago', 60], [nyc, 30], ['remote', 10]],
    careers: [['marketing', 35], ['supply-chain', 20], ['sales', 12], ['business-analytics', 12], ['operations', 10], ['corporate-finance', 6], ['people-hr', 5]],
  },
  {
    slug: 'blue-heron-goods', name: 'Blue Heron Goods', industry: 'consumer', weight: 2.5,
    blurb: 'is a packaged goods company with plants and distribution centers across the South.',
    cities: [['charlotte', 50], ['atlanta', 40], ['miami', 10]],
    careers: [['supply-chain', 30], ['marketing', 24], ['operations', 16], ['sales', 12], ['business-analytics', 10], ['corporate-finance', 8]],
  },
  {
    slug: 'maple-finch', name: 'Maple & Finch', industry: 'consumer', weight: 3,
    blurb: 'is a fashion and accessories retailer with stores in major Northeast cities.',
    cities: [[nyc, 55], ['boston', 25], ['philadelphia', 20]],
    careers: [['marketing', 36], ['sales', 20], ['supply-chain', 14], ['business-analytics', 12], ['corporate-finance', 8], ['operations', 6], ['people-hr', 4]],
  },
  {
    slug: 'wildgrove-foods', name: 'Wildgrove Foods', industry: 'consumer', weight: 3,
    blurb: 'is a food company that makes snacks and frozen meals for grocery stores.',
    cities: [['chicago', 55], ['dallas', 35], ['remote', 10]],
    careers: [['supply-chain', 34], ['marketing', 24], ['operations', 14], ['sales', 12], ['business-analytics', 10], ['corporate-finance', 6]],
  },
  {
    slug: 'cardinal-row', name: 'Cardinal Row Apparel', industry: 'consumer', weight: 1, noCurrent: true, lastOpenWindow: ['2025-10-18', '2025-10-18'],
    blurb: 'is an apparel label that recruits its marketing and merchandising interns each fall.',
    cities: [[nyc, 60], ['los-angeles', 40]],
    careers: [['marketing', 55], ['sales', 20], ['supply-chain', 15], ['business-analytics', 10]],
  },
  {
    slug: 'harvest-moon', name: 'Harvest Moon Beverage Co.', industry: 'consumer', weight: 2.5,
    blurb: 'bottles and distributes sparkling drinks and teas across the Southeast and Florida.',
    cities: [['atlanta', 45], ['miami', 35], ['charlotte', 20]],
    careers: [['marketing', 32], ['sales', 20], ['supply-chain', 20], ['operations', 10], ['business-analytics', 10], ['corporate-finance', 8]],
  },
  {
    slug: 'tumbleweed-retail', name: 'Tumbleweed Retail Group', industry: 'consumer', weight: 2.5,
    blurb: 'runs a chain of home and outdoor stores across Texas.',
    cities: [['dallas', 40], ['houston', 35], ['austin', 25]],
    careers: [['sales', 24], ['supply-chain', 22], ['marketing', 22], ['operations', 14], ['business-analytics', 10], ['people-hr', 8]],
  },
  {
    slug: 'goldfinch-home', name: 'Goldfinch Home', industry: 'consumer', weight: 2,
    blurb: 'is an online-first furniture and decor brand.',
    cities: [['chicago', 40], ['denver', 30], ['remote', 30]],
    careers: [['marketing', 36], ['business-analytics', 18], ['supply-chain', 16], ['sales', 12], ['product-management', 10], ['operations', 8]],
  },

  // ---------------- healthcare (5) ----------------
  {
    slug: 'verdant-health', name: 'Verdant Health Partners', industry: 'healthcare', weight: 3,
    blurb: 'is a hospital and clinic network serving communities across Georgia and Florida.',
    cities: [['atlanta', 60], ['miami', 25], ['charlotte', 15]],
    careers: [['operations', 28], ['business-analytics', 22], ['corporate-finance', 15], ['strategy', 12], ['supply-chain', 10], ['people-hr', 8], ['marketing', 5]],
  },
  {
    slug: 'alder-creek-pharma', name: 'Alder Creek Pharma', industry: 'healthcare', weight: 2.5,
    blurb: 'develops and sells prescription medicines and runs a large commercial team.',
    cities: [['boston', 50], ['philadelphia', 50]],
    careers: [['marketing', 24], ['business-analytics', 22], ['sales', 15], ['corporate-finance', 15], ['supply-chain', 12], ['strategy', 12]],
  },
  {
    slug: 'lifespring-medical', name: 'Lifespring Medical Group', industry: 'healthcare', weight: 2,
    blurb: 'is a physician group and outpatient care provider in Texas and the capital region.',
    cities: [['houston', 40], ['dallas', 35], ['dc', 25]],
    careers: [['operations', 32], ['business-analytics', 22], ['corporate-finance', 16], ['people-hr', 15], ['strategy', 15]],
  },
  {
    slug: 'halden-biosciences', name: 'Halden Biosciences', industry: 'healthcare', weight: 1.5,
    blurb: 'is a biotechnology company moving two treatments toward approval.',
    cities: [['boston', 60], ['sf-bay', 40]],
    careers: [['business-analytics', 28], ['strategy', 22], ['corporate-finance', 20], ['operations', 15], ['marketing', 15]],
  },
  {
    slug: 'bluebell-care', name: 'Bluebell Care Network', industry: 'healthcare', weight: 2,
    blurb: 'runs senior living and home care services across the Southeast.',
    cities: [['atlanta', 45], ['charlotte', 30], ['miami', 25]],
    careers: [['operations', 30], ['people-hr', 20], ['marketing', 18], ['business-analytics', 16], ['corporate-finance', 16]],
  },

  // ---------------- media (5) ----------------
  {
    slug: 'magnolia-media', name: 'Magnolia Media Group', industry: 'media', weight: 3,
    blurb: 'is an Atlanta media company that owns regional television stations, podcasts and a lifestyle publishing arm.',
    cities: [['atlanta', 72], [nyc, 14], ['los-angeles', 9], ['remote', 5]],
    careers: [['marketing', 52], ['sales', 14], ['business-analytics', 10], ['strategy', 8], ['operations', 8], ['people-hr', 4], ['corporate-finance', 4]],
    prefer: { marketing: ['Brand', 'Content', 'Partnerships', 'Events', 'Creative', 'Digital'] },
    boost: { marketing: ['brand'] },
  },
  {
    slug: 'redline-studios', name: 'Redline Studios', industry: 'media', weight: 2,
    blurb: 'is a film and series studio with a development slate in Los Angeles and New York.',
    cities: [['los-angeles', 65], [nyc, 35]],
    careers: [['marketing', 34], ['business-analytics', 20], ['corporate-finance', 16], ['strategy', 15], ['sales', 15]],
  },
  {
    slug: 'parkside-broadcasting', name: 'Parkside Broadcasting', industry: 'media', weight: 2,
    blurb: 'is a national news and sports broadcaster.',
    cities: [[nyc, 55], ['dc', 45]],
    careers: [['sales', 30], ['marketing', 28], ['business-analytics', 16], ['operations', 14], ['strategy', 12]],
  },
  {
    slug: 'echo-valley', name: 'Echo Valley Entertainment', industry: 'media', weight: 2,
    blurb: 'runs live music venues, a ticketing platform and a streaming label.',
    cities: [['los-angeles', 40], ['atlanta', 35], ['austin', 25]],
    careers: [['marketing', 36], ['sales', 20], ['operations', 16], ['business-analytics', 16], ['corporate-finance', 12]],
  },
  {
    slug: 'paper-lantern', name: 'Paper Lantern Publishing', industry: 'media', weight: 1.5,
    blurb: 'publishes books, magazines and newsletters for general readers.',
    cities: [[nyc, 50], ['boston', 25], ['chicago', 25]],
    careers: [['marketing', 40], ['sales', 20], ['business-analytics', 15], ['operations', 15], ['strategy', 10]],
  },

  // ---------------- industrials (4) ----------------
  {
    slug: 'ferrous-lowell', name: 'Ferrous & Lowell Manufacturing', industry: 'industrials', weight: 3,
    blurb: 'makes steel components and machinery for construction and transportation customers.',
    cities: [['chicago', 45], ['charlotte', 30], ['dallas', 25]],
    careers: [['supply-chain', 32], ['operations', 28], ['corporate-finance', 12], ['sales', 10], ['business-analytics', 10], ['people-hr', 8]],
  },
  {
    slug: 'atlas-ridge', name: 'Atlas Ridge Industries', industry: 'industrials', weight: 2,
    blurb: 'is a diversified industrial company that builds pumps, valves and electrical equipment.',
    cities: [['houston', 50], ['denver', 30], ['chicago', 20]],
    careers: [['operations', 30], ['supply-chain', 28], ['sales', 14], ['corporate-finance', 12], ['business-analytics', 10], ['people-hr', 6]],
  },
  {
    slug: 'corvid-logistics', name: 'Corvid Logistics', industry: 'industrials', weight: 3,
    blurb: 'moves freight by truck, rail and air for retailers and manufacturers.',
    cities: [['atlanta', 35], ['dallas', 30], ['chicago', 35]],
    careers: [['supply-chain', 48], ['operations', 22], ['business-analytics', 12], ['sales', 10], ['people-hr', 8]],
  },
  {
    slug: 'bellwether-aerospace', name: 'Bellwether Aerospace', industry: 'industrials', weight: 2,
    blurb: 'builds aircraft parts and satellite components for commercial and government customers.',
    cities: [['seattle', 40], ['dc', 30], ['los-angeles', 30]],
    careers: [['supply-chain', 28], ['operations', 26], ['corporate-finance', 16], ['business-analytics', 14], ['strategy', 8], ['people-hr', 8]],
  },

  // ---------------- energy (3) ----------------
  {
    slug: 'sandstone-energy', name: 'Sandstone Energy Partners', industry: 'energy', weight: 3,
    blurb: 'is an oil and gas producer with operations in Texas and the Rocky Mountains.',
    cities: [['houston', 55], ['dallas', 25], ['denver', 20]],
    careers: [['corporate-finance', 30], ['operations', 24], ['strategy', 16], ['supply-chain', 16], ['business-analytics', 14]],
  },
  {
    slug: 'windmere-renewables', name: 'Windmere Renewables', industry: 'energy', weight: 2,
    blurb: 'develops wind and solar projects and sells the power to utilities.',
    cities: [['denver', 45], ['austin', 35], ['remote', 20]],
    careers: [['strategy', 26], ['corporate-finance', 24], ['business-analytics', 22], ['operations', 16], ['marketing', 12]],
  },
  {
    slug: 'prairie-gate', name: 'Prairie Gate Utilities', industry: 'energy', weight: 2,
    blurb: 'is an electric and gas utility serving the upper Midwest and Texas.',
    cities: [['chicago', 60], ['dallas', 40]],
    careers: [['operations', 30], ['corporate-finance', 24], ['business-analytics', 20], ['supply-chain', 14], ['people-hr', 12]],
  },

  // ---------------- real estate (3) ----------------
  {
    slug: 'linden-court', name: 'Linden Court Realty', industry: 'real-estate', weight: 3,
    blurb: 'owns and operates office, apartment and retail properties in major cities.',
    cities: [[nyc, 40], ['chicago', 30], ['los-angeles', 30]],
    careers: [['real-estate', 62], ['asset-management', 12], ['corporate-finance', 10], ['business-analytics', 10], ['marketing', 6]],
  },
  {
    slug: 'ashgrove-development', name: 'Ashgrove Development', industry: 'real-estate', weight: 2,
    blurb: 'builds mixed-use neighborhoods and apartment communities across the Sun Belt.',
    cities: [['atlanta', 40], ['miami', 30], ['charlotte', 30]],
    careers: [['real-estate', 65], ['corporate-finance', 12], ['business-analytics', 10], ['marketing', 8], ['operations', 5]],
  },
  {
    slug: 'harrow-street', name: 'Harrow Street Capital Partners', industry: 'real-estate', weight: 2,
    blurb: 'invests in warehouses, apartments and medical offices on behalf of pension funds.',
    cities: [['dallas', 40], ['houston', 30], ['austin', 30]],
    careers: [['real-estate', 50], ['asset-management', 25], ['corporate-finance', 15], ['business-analytics', 10]],
  },

  // ---------------- public sector (2) ----------------
  {
    slug: 'harbor-county-transit', name: 'Harbor County Transit Authority', industry: 'public-sector', weight: 2,
    blurb: 'runs bus and rail service for a coastal county and plans its long-term capital projects.',
    cities: [['other', 100]],
    careers: [['operations', 32], ['business-analytics', 24], ['strategy', 18], ['corporate-finance', 14], ['people-hr', 12]],
  },
  {
    slug: 'federal-commons', name: 'Federal Commons Policy Institute', industry: 'public-sector', weight: 2,
    blurb: 'is a nonpartisan policy institute that studies budgets, labor markets and public programs.',
    cities: [['dc', 85], ['remote', 15]],
    careers: [['strategy', 30], ['business-analytics', 30], ['operations', 16], ['people-hr', 12], ['corporate-finance', 12]],
  },
];

export const INDUSTRY_SHARES: [IndustryId, number][] = [
  ['finance', 27],
  ['consulting', 11],
  ['accounting', 7],
  ['technology', 15],
  ['consumer', 14],
  ['healthcare', 6],
  ['media', 6],
  ['industrials', 5],
  ['energy', 3],
  ['real-estate', 3.5],
  ['public-sector', 2.5],
];
