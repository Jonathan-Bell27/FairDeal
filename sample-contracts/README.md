# Sample contracts

Fictional Georgia car deals for testing extraction and the rules engine. `answer_key.json` has the exact numbers on each document, the inputs to test with (credit tier, KBB value) and the flags a good analysis should raise.

| # | Scenario | Layout | Expected verdict |
|---|---|---|---|
| 01 | Clean deal | Buyer's order | Fair deal |
| 02 | Every red flag (main demo) | Buyer's order + phone photo | Walk away |
| 03 | A few issues, trade-in with payoff | Buyer's order + phone photo | Negotiate |
| 04 | Buy-here-pay-here, high-mileage car | Retail installment contract | Walk away |
| 05 | Negative-equity trade-in, 75 months | Buyer's order + phone photo | Negotiate |
| 06 | New car, 1.9% promo rate | Buyer's order | Fair deal |
| 07 | High-mileage SUV, stacked add-ons | Retail installment contract + phone photo | Walk away |
| 08 | Cash deal, no loan terms on the page | Buyer's order | Negotiate |
| 09 | 84-month loan, zero down | Buyer's order + phone photo (blurry) | Walk away |
| 10 | Close call, small markups | Retail installment contract | Negotiate |

Each contract has a PDF and a PNG; some also have a phone photo (angled, uneven light, slight blur).

- `npm test` in `server/` checks the rules engine against the answer key (free).
- `npm run check` in `server/` sends every file to Claude and compares the extracted numbers to the answer key (costs a few cents).

Contracts 05-10 are generated: `python3 tools/make_samples.py` then `python3 tools/make_images.py` from the repo root (needs `reportlab`, `Pillow`, `numpy` and `pdftoppm`).
