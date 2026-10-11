# FairDeal demo video: shot list

**File:** FairDeal-demo.mp4 · 1920×1080 · 30 fps · 2:45 long · captions only, silent audio track

| Time | On screen | Caption |
|---|---|---|
| 0:00.0 | Title card | FairDeal Is this car deal fair? Snap a photo and find out, right on the lot. HACKLANTA II · SOCIAL GOOD TRACK |
| 0:04.0 | Title card | The problem A car is the biggest purchase most people make without a second opinion. |
| 0:08.1 | Title card | Junk fees. Padded add-ons. Marked-up rates. Buried in paperwork people sign under pressure. I saw it as a first-time buyer, and my grandfather got ripped off. |
| 0:13.6 | Title card | Meet FairDeal A second opinion, right on the lot. Snap your contract and see what's fair, what's not, and what to say back. |
| 0:17.6 | Type the KBB value, upload a photo, "Reading your contract…" | **Snap your contract**: Pick your credit range, add the Kelley Blue Book value, and take a photo of your buyer's order or loan offer. |
| 0:26.3 | Scroll through the numbers Claude read | **Check the numbers**: Claude reads every number off the paperwork. Fix anything it misread before the deal is scored. |
| 0:32.7 | Tap "Check this deal": dial swings to 0, red-pen receipt, open a "why" note | **Walk away: 0 out of 100**: Our rules engine scores the deal against real market data and marks every overcharge in red. |
| 0:44.4 | Three phones: red (0), yellow (74), green (100) dials swing into place | Every deal gets a clear answer. |
| 0:50.4 | Tap "Show me the fair deal": dial climbs to 100, payment drops to $522 | **See the fair version**: One tap shows the deal if the dealer fixed every marked line: $522 a month instead of $700. |
| 1:00.9 | Scroll to the fine print cards, tap "Show the dealer" | **Read the fine print**: Claude quotes the clauses that matter word for word, explained with information from the FTC and CFPB. One tap shows the dealer. |
| 1:09.4 | Open the counteroffer | **Your counteroffer, written**: Every flag becomes a specific ask. Text it to the dealer in one tap. |
| 1:16.2 | Open the share card and QR code | **Ask someone you trust**: Send a share card, link or QR code that opens this exact markup on their phone. |
| 1:23.3 | Fill in ZIP and pay, tap "Research my deal": live searches, then the plan | **A plan made for you**: Our agent searches the web for recalls, lender rates and similar cars, then writes a plan for your budget. Every link is a page it actually read. *(note: Example responses shown)* |
| 1:45.4 | Tap "Is GAP required to get this loan?": Claude searches and answers | **Ask anything about your deal**: Claude knows your contract and your flags, and looks things up when it needs to. *(note: Example responses shown)* |
| 1:59.1 | Mike pushes paint protection and GAP, the buyer says no twice, then an 8/10 coaching card | **Practice saying no to Mike**: Claude plays Mike, a pushy finance manager who pushes the add-ons we flagged. Hold your ground, then get coached. *(note: Example responses shown)* |
| 2:25.6 | Switch to Spanish, then light mode, then back to English | **English or Spanish. Light or dark.**: Every screen, flag and counteroffer works in both languages, and nothing is saved on our server. |
| 2:33.5 | Title card | How it works Claude reads. The rules judge. Photo Buyer's order or loan offer → Claude Reads every number, researches, coaches → Rules engine Experian rates, KBB value, Consumer Reports prices → Your answer Score, red-pen flags, counteroffer REACT + VITE ON VERCEL · NODE + EXPRESS ON RENDER · CLAUDE API |
| 2:40.0 | Title card | FairDeal Know what you're signing. FAIR-DEAL-TEN.VERCEL.APP |

## How it was made
- Every phone clip is a real recording of the current app's screens and animations, not a mockup. The main flow is in dark mode and uses sample contract 02. The three dials use samples 02, 10 and 01.
- The plan, Ask FairDeal and Mike chapters use **scripted example answers**, streamed through the app's real chat and plan screens, because this environment can't reach the live site. Those chapters say "Example responses shown". The answers only use facts from the sample contract and the app's data: the contract's own optional-products clause, GAP about $400 elsewhere, the 8.81% good-credit average, the $522 fair payment and the $8,379 saved by a 60-month term.

## To upload to Devpost
Devpost takes a link, not a file. Upload FairDeal-demo.mp4 to YouTube (Public or Unlisted) or Vimeo, then paste the link in the video field.
