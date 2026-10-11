## Inspiration

As a first-time car buyer, I experienced firsthand how predatory a dealership can be. You sit across the desk from people who do this every day, and you're handed a stack of paperwork full of fees, add-ons and loan terms you've never seen before, with pressure to sign right now.

I'm not the only one. My grandfather got ripped off on a car deal too. And every time I scroll social media, I see another video of dealers bragging about how much money they make on a single sale, much of it from customers who never understood what they agreed to.

So from my own experience, my grandfather's, and everything I kept seeing online, I wanted to build something any buyer could use **right now**, on the lot, before they sign. FairDeal gives first-time buyers, and every other buyer, a clear understanding of what's actually being offered, and the peace of mind that comes with it.

## What it does

Snap a photo of your buyer's order or loan offer. FairDeal:

- **Reads every number** on the paperwork (price, fees, add-ons, APR, term, payment) and lets you fix anything it misread.
- **Scores the deal from 0 to 100** and gives a verdict: *Fair deal*, *Negotiate*, or *Walk away*.
- **Marks up the contract in red pen.** Every overcharge gets a line showing what you were charged, what's typical and how much it costs you. Tap it for the full explanation and the source.
- **Writes your counteroffer**, ready to text to the dealer in one tap.
- **Fix-It Mode** ("Show me the fair deal") shows what the deal would look like if the dealer fixed every line that costs points: the new payment, term and rate.
- **Fine Print Shield** ("In the fine print") quotes the clauses that matter, like spot delivery or "sold as is," word for word and explains them in plain language, using information from the FTC and CFPB.
- **Go deeper** with a personal plan: our agent researches recalls, known problems, rates from nearby lenders and similar cars for sale. You can also ask questions about your deal, or **practice saying no** to Mike, a pushy finance manager.
- **Get a second opinion** by sending a friend a share card, link or QR code.
- Works in **English and Spanish**, in light or dark mode, and our server saves nothing. Photos are redrawn on your phone before upload to strip hidden location data.

## How we built it

**Stack:** a mobile-first React + Vite app on Vercel, a Node.js + Express server on Render, and the Claude API for reading documents, research and conversation.

**The core idea: Claude reads, the rules judge.** We didn't want an AI making up dollar amounts about someone's biggest purchase. So Claude does what it's best at: reading a crumpled photo of a contract into a strict schema of 15 fields, searching the web, and talking with the buyer. Every score, flag and savings figure on the marked-up contract comes from a deterministic rules engine. The same deal always gets the same score, and anyone can check the math.

**The math.** Everything starts from the standard loan payment formula, where *P* is the amount financed, *a* is the APR in percent and *n* is the number of months:

$$
M(P, a, n) = \frac{P \cdot r}{1 - (1 + r)^{-n}}, \qquad r = \frac{a}{1200}
$$

The cost of a marked-up rate is the extra interest over the life of the loan, compared with ā, Experian's average used-car APR for the buyer's credit tier:

$$
\Delta_{\text{APR}} = n \cdot \left[ M(P, a, n) - M(P, \bar{a}, n) \right]
$$

Each red flag costs the buyer some number of dollars, *d*, and costs the deal one point per $100 of that, capped at 25 points per flag. That way the score reflects how many things are wrong, not just the single most expensive one. (Cautions shown for information, like the interest on a service contract, cost no points.) The Deal Score adds up every red flag:

$$
S = \max\left(0,\ 100 - \sum \min\left(25,\ \mathrm{round}\left(\frac{d}{100}\right)\right)\right)
$$

A score of 85 or more is a *Fair deal*, 60 to 84 means *Negotiate*, and below 60 means *Walk away*.

**Real data, cited on screen.** Typical rates come from Experian's average used-car APRs by credit tier. Add-on prices come from Consumer Reports, Insurance.com and other sources, plus a few FairDeal estimates that are labeled as ours. Georgia's average doc fee comes from CarEdge, and the buyer enters the car's Kelley Blue Book value so we can check the price. Every flag shows where its number came from.

**The research agent** uses Claude's web search tool and streams its progress to the phone live, so the buyer watches it work. It must submit its plan through a strict tool schema, and we only keep links Claude actually retrieved, so it can't hand the buyer a made-up source.

**Testing.** We built 10 fictional Georgia contracts, from a clean deal to one with every red flag at once, plus an answer key with every number. A script turns five of them into realistic phone photos: angled, unevenly lit and slightly blurry. One command sends all 25 files (PDFs, images and phone photos) to Claude and checks 11 key values per file, plus the verdict, against the answer key. The server has 46 automated tests, 37 of them for the rules engine.

We built it mostly through GitHub pull requests, using Claude Code as a coding partner.

## Challenges we ran into

**Trusting AI with money.** Our first instinct was to let the AI judge the deal. But a buyer standing on the lot needs numbers they can trust and check. Splitting the work was the most important decision we made: Claude reads, the rules judge, and people write the legal explanations.

**We were overstating the savings.** Our main demo deal has both a marked-up rate and an 84-month loan. Lowering the rate to the average saves money, and so does shortening the loan to 60 months, but both savings come out of the same interest, so adding them up counted that interest twice. Our first version told the buyer they could save $30,812. With T(a, n) = n · M(P, a, n) as the total paid, the part counted twice is:

$$
O = \left[T(a, n) - T(\bar{a}, n)\right] - \left[T(a, 60) - T(\bar{a}, 60)\right]
$$

Subtracting it gives the honest number: $30,812 − $5,027 = **$25,785**.

**Catching padded payments without false alarms.** Dealers sometimes print a monthly payment higher than the loan math gives and pocket the difference. But a correctly disclosed payment can also be a little higher, because many lenders schedule the first payment up to 45 days after signing instead of the usual 30. Those extra 15 days of interest raise each payment by about half of one month's interest rate applied to the payment, around $5.54 on our demo deal. So we only flag a gap bigger than that, plus a rounding tolerance of $2 or 0.5%, whichever is more:

$$
M_{\text{printed}} - \hat{M} > \max\left(2,\ 0.005 \cdot \hat{M}\right) + \frac{\hat{M}}{2} \cdot \frac{a}{1200}, \qquad \hat{M} = M(P, a, n)
$$

**Sharing without a database.** We wanted buyers to send a deal to a friend without us storing anyone's financial details. The whole deal is compressed into the link itself, after the `#`, which browsers don't send to a server. When a friend opens the link, the app sends just the numbers to our server to be scored again, and the server keeps nothing.

**Free-tier servers fall asleep.** Our server can take up to a minute to wake up, which feels broken to someone on the lot. The app pings the server the moment the page loads, so it's usually awake by the time the photo is ready.

**Merging teammates' work.** On a teammate's branch, a single missing semicolon in a stylesheet silently swallowed the line after it. We caught it by comparing screenshots before merging, so it never reached the live app.

## Accomplishments that we're proud of

- **It reads messy paperwork, right now.** In our last full accuracy run, Claude got **275 of 275** checked values right across all 25 test files, including the blurry phone photos, and FairDeal gave the right verdict on **25 of 25**.
- **A full product, not a demo.** Reading, scoring, the counteroffer, Fix-It Mode, fine print, live research, negotiation practice and sharing all work end to end on the live site.
- **Built for everyone on the lot.** Bilingual in English and Spanish, down to the rules engine's explanations, and private by design.

## What we learned

- **How expensive a high rate is.** On our demo deal, an 18.99% rate instead of the 8.81% average for good credit costs $15,275 over 84 months. That's more than all the fees and add-ons on the contract combined ($8,777). Even 3 points above average would cost $4,244.
- **Where AI shines and where it shouldn't decide.** Language models are incredible at reading messy documents, research and conversation. Judging money is better left to transparent, testable rules.
- **Consumer protection law.** Federal law doesn't give you 3 days to cancel a car you buy at a dealership; the FTC's Cooling-Off Rule doesn't cover it. With "spot delivery," a dealer lets you drive home before your financing is final, then may call you back and ask you to sign a new contract at a higher rate. The CFPB calls this a "yo-yo" sale, and you don't have to sign. Every buyer should know these things before signing, so FairDeal tells them.
- **Designing for pressure.** Someone standing on a lot doesn't want a dashboard. They want one clear answer, in plain words, in their language, with something they can say back to the dealer.

## What's next for FairDeal

- **Every state, not just Georgia.** Doc fee averages and taxes vary by state, so we want local data for all 50.
- **Leases.** Lease contracts hide costs differently (money factor, residual value), and buyers deserve the same clarity there.
- **A fair loan, one tap away.** When FairDeal says *Walk away*, the next step should be a better offer, like pre-approval from a local credit union.
- **More languages**, so even more buyers understand what they're signing.
