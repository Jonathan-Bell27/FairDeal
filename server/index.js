import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { extractDeal, MODEL, SUPPORTED_TYPES } from "./extract.js";
import { analyze, CREDIT_TIERS, DISCLAIMER } from "./rules.js";
import { dealSchema, emptyDeal } from "./schema.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// CLIENT_ORIGIN can be a comma-separated list (e.g. the Vercel URL). Unset = allow all.
const origins = process.env.CLIENT_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(origins ? { origin: origins } : {}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, model: MODEL, has_api_key: Boolean(process.env.ANTHROPIC_API_KEY) });
});

// Everything the frontend needs to build the Upload and Review screens.
app.get("/config", (req, res) => {
  res.json({
    credit_tiers: CREDIT_TIERS,
    accepted_types: Object.keys(SUPPORTED_TYPES),
    schema: dealSchema,
    empty_deal: emptyDeal(),
    disclaimer: DISCLAIMER,
  });
});

// multipart/form-data with field "file" (photo or PDF). Returns { deal, ms }.
app.post("/extract", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Send the photo or PDF in a form field named "file".' });
  if (!SUPPORTED_TYPES[req.file.mimetype]) {
    return res.status(415).json({
      error: `Unsupported file type ${req.file.mimetype}. Use a JPEG, PNG, WebP, or PDF.`,
    });
  }
  const started = Date.now();
  try {
    const deal = await extractDeal(req.file.buffer, req.file.mimetype);
    res.json({ deal, ms: Date.now() - started });
  } catch (err) {
    console.error("extract failed:", err);
    if (err instanceof Anthropic.APIError) {
      const status = err instanceof Anthropic.RateLimitError ? 429 : 502;
      return res.status(status).json({ error: `Claude API error (${err.status ?? "network"}). Try again or use manual entry.` });
    }
    res.status(502).json({ error: err.message || "Extraction failed. Try manual entry." });
  }
});

// JSON body: { deal, credit_tier, kbb_value }. Returns score, flags, savings, counteroffer.
app.post("/analyze", (req, res) => {
  const { deal, credit_tier, kbb_value } = req.body ?? {};
  if (!deal || typeof deal !== "object") return res.status(400).json({ error: "Missing deal." });
  try {
    res.json(analyze(deal, { creditTier: credit_tier, kbbValue: kbb_value }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ error: "File is too large (10 MB max)." });
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`FairDeal server on http://localhost:${port}`));
