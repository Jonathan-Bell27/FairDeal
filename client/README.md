# FairDeal client

React (Vite), mobile-first. Upload → Review → Results → Counteroffer, plus manual entry.

## Run it

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

It calls the live backend at `https://fairdeal-jamn.onrender.com` by default. To use a local server instead, create `client/.env.local`:

```
VITE_API_URL=http://localhost:3001
```

To test on your phone on the same Wi-Fi: `npm run dev -- --host`, then open the "Network" address it prints.

## Files

| File | What it does |
| --- | --- |
| `src/App.jsx` | Holds the state and switches between screens |
| `src/screens/Upload.jsx` | Credit tier, KBB value, camera/file buttons, calls `/extract` |
| `src/screens/Review.jsx` | Editable form for every field; also the manual entry form |
| `src/screens/Results.jsx` | Score, verdict, savings, flags with sources, disclaimer |
| `src/screens/Counteroffer.jsx` | Editable message, Text button (`sms:` link), Copy button |
| `src/api.js` | Backend calls (`/extract`, `/analyze`) and the backend URL |
| `src/image.js` | Shrinks photos and converts iPhone HEIC to JPEG before upload |
| `src/index.css` | All styles, with light and dark mode |

## Deploy to Vercel

New Project → import the FairDeal repo → **Root Directory: `client`** (Vite is detected automatically) → Deploy.
