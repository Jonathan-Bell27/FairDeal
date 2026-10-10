// Lookup tables for the rules engine. Kept in code so the engine runs with no
// database; move to Supabase later if you want to edit them without a deploy.
//
// APR figures: Experian, Q2 2026, average used-vehicle APR by VantageScore 4.0
// tier (experian.com/blogs/ask-experian/used-car-loan-rates/).

export const APR_SOURCE =
  "Experian, State of the Automotive Finance Market, Q2 2026 (average used-vehicle APR by credit tier)";

// FairDeal tier -> Experian tier, and the average used-vehicle APR (%).
export const TYPICAL_APR = {
  Excellent: { experianTier: "Super prime (781-850)", apr: 6.29 },
  Good: { experianTier: "Prime (661-780)", apr: 8.81 },
  Fair: { experianTier: "Near prime (601-660)", apr: 13.93 },
  Poor: { experianTier: "Subprime (501-600)", apr: 19.1 },
};

// Flag an APR only when it beats the average by more than this many points.
export const APR_TOLERANCE = 0.5;

// Add-ons and dealer fees. `fair` is what the item typically costs elsewhere
// (0 = shouldn't be charged at all); `flagAbove` is the price that triggers a flag.
// Dollar impact = price - fair. First matching entry wins, so order matters.
export const ADD_ONS = [
  {
    key: "gps",
    label: "GPS tracker / starter interrupt",
    match: /gps|starter.?interrupt|tracking device|kill.?switch/i,
    fair: 0,
    flagAbove: 0,
    why: "This device lets the lender track or disable your car if you miss a payment. It protects the lender, not you, so ask for the charge to be removed.",
    source: "FairDeal reasoning (the device serves the lender); the FTC investigated lenders' use of these devices in 2017",
  },
  {
    key: "nitrogen",
    label: "Nitrogen tire fill",
    match: /nitrogen/i,
    fair: 0,
    flagAbove: 0,
    why: "Air is already mostly nitrogen, and all tires lose pressure over time no matter what's inside. Consumer Reports has seen dealers try to charge up to $400 for this.",
    source: "Consumer Reports, Just Say No to These Car Dealership Extras (Apr 2026)",
  },
  {
    key: "dealer_prep",
    label: "Dealer prep / reconditioning",
    match: /\bprep\b|recondition|pre-?delivery|\bpdi\b/i,
    fair: 0,
    flagAbove: 0,
    why: "Getting the car ready to sell is already built into the price, so a separate prep or reconditioning fee charges you twice. These fees are legal but negotiable.",
    source: "NerdWallet, What Is a Reconditioning Fee on a Used Car?; CarEdge",
  },
  {
    key: "vin_etch",
    label: "VIN etching",
    match: /vin.?etch|etch|theft.?deter/i,
    fair: 20,
    flagAbove: 100,
    why: "Consumer Reports calls VIN etching unnecessary: the VIN is already stamped in several places on every car. Dealers typically charge $200 to $300, and a DIY kit costs about $20.",
    source: "Consumer Reports, Just Say No to These Car Dealership Extras (Apr 2026); GoodCar (DIY kit price)",
  },
  {
    key: "paint_protection",
    label: "Paint / fabric protection",
    match: /paint|fabric|sealant|ceramic|pro.?shield|appearance/i,
    // Flag above CR's typical dealer price; fair = professional detailer price.
    fair: 300,
    flagAbove: 600,
    why: "Consumer Reports says today's paint and fabrics last a decade or longer with regular cleaning, so this isn't necessary. CR's shoppers typically see dealers charge about $600, and a professional detailer charges about $300 for fabric protection.",
    source: "Consumer Reports, Just Say No to These Car Dealership Extras (Apr 2026); UsedCars.com (detailer price)",
  },
  {
    key: "gap",
    label: "GAP coverage",
    match: /\bgap\b/i,
    // Insurer GAP is under $100/yr with most carriers ($36-$95/yr in Georgia);
    // $400 covers about 4 years, longer than most buyers stay upside down.
    fair: 400,
    flagAbove: 600,
    why: "Adding GAP to your car insurance costs under $100 a year with most insurers ($36 to $95 a year in Georgia), so a few years of coverage costs far less than the dealer's price.",
    source: "Insurance.com, How much is gap insurance in 2026? (Dec 2025)",
  },
  {
    key: "service_contract",
    label: "Extended warranty / service contract",
    match: /service contract|extended|warranty|powertrain|vsc|protection plan/i,
    // Fair prices vary too much to call one overpriced; instead show the
    // interest paid on it when it's rolled into the loan (not scored).
    financed: true,
    fair: 0,
    flagAbove: 0,
    why: "This is optional. Consumer Reports notes a service contract can easily add $2,000 or more, and financing it costs even more because you pay interest on it.",
    source: "Consumer Reports, Just Say No to These Car Dealership Extras (Apr 2026); interest from the contract's APR and term",
  },
  {
    key: "tire_wheel",
    label: "Tire & wheel protection",
    match: /tire.*wheel|wheel.*tire/i,
    fair: 300,
    flagAbove: 600,
    why: "Consumer Reports says most cars don't have the expensive low-profile tires this protects, and it often costs several hundred dollars. Check what your car insurance already covers.",
    source: "Consumer Reports, Just Say No to These Car Dealership Extras (Apr 2026)",
  },
  {
    key: "key_replacement",
    label: "Key replacement",
    match: /key/i,
    fair: 150,
    flagAbove: 300,
    why: "A replacement key fob usually costs less than this plan.",
    source: "FairDeal estimate of key fob replacement cost",
  },
  {
    key: "doc_fee",
    label: "Documentation fee",
    match: /doc|documentary|documentation/i,
    // Georgia average; flag only when about $100+ over it.
    fair: 599,
    flagAbove: 700,
    why: "The average dealer doc fee in Georgia is $599. Doc fees are hard to negotiate, so ask the dealer to take the extra off the vehicle price instead.",
    source: "CarEdge, Car Dealer Doc Fee by State in 2026",
  },
];

// Payment packing thresholds.
export const TERM_CAUTION_MONTHS = 72; // flagged, shown but not scored
export const TERM_PACKING_MONTHS = 84; // flagged and scored
export const HIGH_MILEAGE = 75000;

// Price vs. market: flag when the price beats KBB by more than this.
export const PRICE_TOLERANCE = 300;
export const PRICE_SOURCE = "Kelley Blue Book value entered by the buyer";
