// The contract between Claude extraction, the Review screen, and the rules engine.
// Every field is required; Claude uses 0 or "" when a value isn't on the document.
// No min/max constraints here: range checks live in rules.js.

const lineItem = {
  type: "object",
  properties: {
    name: { type: "string" },
    amount: { type: "number" },
  },
  required: ["name", "amount"],
  additionalProperties: false,
};

export const dealSchema = {
  type: "object",
  properties: {
    document_type: { type: "string" },
    vehicle: { type: "string" },
    mileage: { type: "integer" },
    vehicle_price: { type: "number" },
    apr: { type: "number" },
    term_months: { type: "integer" },
    down_payment: { type: "number" },
    trade_in_allowance: { type: "number" },
    trade_in_payoff: { type: "number" },
    monthly_payment: { type: "number" },
    amount_financed: { type: "number" },
    total_of_payments: { type: "number" },
    fees: { type: "array", items: lineItem },
    add_ons: { type: "array", items: lineItem },
    taxes_and_government_fees: { type: "array", items: lineItem },
  },
  required: [
    "document_type",
    "vehicle",
    "mileage",
    "vehicle_price",
    "apr",
    "term_months",
    "down_payment",
    "trade_in_allowance",
    "trade_in_payoff",
    "monthly_payment",
    "amount_financed",
    "total_of_payments",
    "fees",
    "add_ons",
    "taxes_and_government_fees",
  ],
  additionalProperties: false,
};

export const emptyDeal = () => ({
  document_type: "",
  vehicle: "",
  mileage: 0,
  vehicle_price: 0,
  apr: 0,
  term_months: 0,
  down_payment: 0,
  trade_in_allowance: 0,
  trade_in_payoff: 0,
  monthly_payment: 0,
  amount_financed: 0,
  total_of_payments: 0,
  fees: [],
  add_ons: [],
  taxes_and_government_fees: [],
});
