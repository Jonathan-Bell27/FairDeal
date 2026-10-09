# FairDeal server

Express API. Claude reads the document (`/extract`); the rules engine in `rules.js` makes every call (`/analyze`).

## Run it

```bash
cd server
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY; never commit .env
npm run dev            # http://localhost:3001
npm test               # rules engine against sample-contracts/answer_key.json (no API key needed)
npm run check          # live extraction on every sample vs. the answer key (uses the API)
npm run check -- 02    # just the predatory samples
```

## API (the frontend contract)

### `GET /health`
`{ ok, model, has_api_key }`

### `GET /config`
`{ credit_tiers, accepted_types, schema, empty_deal, disclaimer }`. Use `empty_deal` to start the manual entry form.

### `POST /extract`
`multipart/form-data`, field `file`: a JPEG, PNG, WebP, or PDF, up to 10 MB.

```js
const form = new FormData();
form.append("file", fileInput.files[0]);
const { deal, ms } = await fetch(`${API}/extract`, { method: "POST", body: form }).then((r) => r.json());
```

Errors return `{ error }` with status 400, 413, 415, 429, or 502. On any error, show the manual entry form.

`deal` follows `schema.js`. Every field is always present:

```json
{
  "document_type": "Buyer's order",
  "vehicle": "2021 Nissan Altima 2.5 SV 4D SEDAN",
  "mileage": 47880,
  "vehicle_price": 22995,
  "apr": 18.99,
  "term_months": 84,
  "down_payment": 1000,
  "trade_in_allowance": 0,
  "trade_in_payoff": 0,
  "monthly_payment": 700.33,
  "amount_financed": 32419.65,
  "total_of_payments": 58827.72,
  "fees": [{ "name": "Documentary Service Fee", "amount": 899 }],
  "add_ons": [{ "name": "GAP Waiver", "amount": 1495 }],
  "taxes_and_government_fees": [{ "name": "TAVT", "amount": 1610 }]
}
```

### `POST /analyze`
JSON: `{ "deal": <reviewed deal>, "credit_tier": "Excellent" | "Good" | "Fair" | "Poor", "kbb_value": 19800 }`

Numbers may come back from form inputs as strings (`"$19,800"` is fine). Missing `amount_financed`, `monthly_payment`, or `total_of_payments` are computed.

Response:

```json
{
  "score": 0,
  "verdict": { "key": "walk", "label": "Walk away or get outside financing" },
  "total_savings": 34109,
  "flags": [
    {
      "id": "apr",
      "category": "APR vs. credit tier",
      "severity": "red",
      "title": "APR 18.99% is 11.0 points above typical for Good credit",
      "detail": "Buyers with good credit ...",
      "dollar_impact": 16383,
      "points": 25,
      "source": "Experian, State of the Automotive Finance Market ...",
      "ask": "Lower the APR to 8% ..."
    }
  ],
  "counteroffer": "Hi, I'm interested in ...",
  "deal": { },
  "inputs": { "credit_tier": "Good", "kbb_value": 19800 },
  "disclaimer": "AI-assisted analysis for informational purposes. Not financial advice. Verify terms before signing."
}
```

`verdict.key` is `fair` (85-100), `negotiate` (60-84), or `walk` (below 60). `severity` is `red` (counted in the score and savings) or `caution` (shown, not scored: a 72-83 month term). For the text button: `sms:?&body=${encodeURIComponent(counteroffer)}`.

## Scoring

Start at 100, subtract 1 point per $100 of avoidable cost, max 25 points per flag, floor 0. Thresholds, typical prices, and sources are in `data/lookups.js`.

Before the pitch, replace the placeholder APR figures in `data/lookups.js` with the numbers from the latest Experian report.
