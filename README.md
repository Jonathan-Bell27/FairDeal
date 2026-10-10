# FairDeal

**Hacklanta II | Social Good Track (presented by Cox Automotive)**

Snap a photo of a car loan offer or buyer's order. FairDeal reads the terms, flags junk add-ons, overpriced protection products, markups, and APRs well above typical for your credit tier, then writes a counteroffer you can send straight to the dealer.

Built mobile-first for buyers standing on the lot.

**New here?** [The complete guide (PDF)](docs/FairDeal-Guide.pdf) explains every feature, how FairDeal uses the Claude API, where the facts come from, and what each file does, with no technical background needed.

---

## How It Works

1. **Upload** a photo or PDF of the deal and pick your credit tier.
2. **Review** the terms Claude extracted. Fix anything it misread.
3. **See the results**: a Deal Score, every red flag with its dollar impact and source, and your total potential savings.
4. **Push back** with a generated counteroffer. Copy it or text it to the dealer in one tap.

---

## MVP Features

### 1. Input
- Photo or PDF upload
- Credit tier dropdown: Excellent / Good / Fair / Poor
- Manual entry form as a fallback if extraction fails

### 2. Extraction
Claude reads the document and fills a fixed JSON schema:
- Vehicle price
- APR
- Loan term
- Down payment
- Monthly payment
- Itemized fees and add-ons

The user reviews and edits every field before analysis.

### 3. Rules Engine
Plain code, not the LLM, so every flag is deterministic and explainable.

| Check | What it flags |
| --- | --- |
| APR vs. credit tier | Rate well above typical for the user's credit tier |
| Add-ons and protection products | VIN etching, nitrogen tires, paint protection, dealer prep, GAP, extended warranty priced above typical ranges |
| Long loan term | 72+ month terms (scored at 84+); shows total paid vs. car price |
| Price vs. market | Deal price vs. the KBB value the user enters |
| Contract math | Amount financed more than $25 above what the itemized lines add up to; monthly payment above what the amount financed, APR and term work out to (shows the implied APR). Only checks totals printed on the document |
| Negative equity | Trade-in payoff more than $50 above the trade-in allowance, rolled into the loan; shows the interest it costs and, with a KBB value, loan-to-value (shown, not scored) |

### 4. Results Screen
- Deal Score
- Each flag with its dollar impact and source
- Total potential savings
- Disclaimer: AI-assisted analysis for informational purposes. Not financial advice.

### 5. Counteroffer
- Generated message asking the dealer to remove flagged items and match a fair rate
- Copy button
- `sms:` link that opens the phone's text app pre-filled

### 6. Mobile-First UI
Built and tested on a phone from day one.

---

## Deal Score

Start at **100**. Subtract **1 point per $100** of avoidable cost, capped at **25 points per flag**. Minimum **0**.

| Score | Verdict |
| --- | --- |
| 85 to 100 | Fair deal |
| 60 to 84 | Negotiate before signing |
| Below 60 | Walk away or get outside financing |

---

## Stretch Goals

1. **Accuracy test**: 10 sample contracts plus a script that reports extraction and flag accuracy.
2. **Spanish toggle** for results and counteroffer.
3. **True monthly cost of ownership**: insurance, gas, and repairs.

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React (Vite), mobile-first |
| Backend | Node.js / Express (holds the API key, runs the rules engine) |
| LLM | Claude API with structured outputs (reads photos and PDFs natively) |
| Data | Supabase (APR by tier, add-on price ranges, uploads, test results) |
| Hosting | Vercel (frontend), Render or Railway (backend) |
