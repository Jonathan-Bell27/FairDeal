import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { extractDeal, MODEL, SUPPORTED_TYPES } from "./extract.js";
import { analyze, CREDIT_TIERS, DISCLAIMER } from "./rules.js";
import { runAdvisor } from "./advisor.js";
import { openStream } from "./sse.js";
import { rateLimit } from "./limits.js";
import { dealSchema, emptyDeal } from "./schema.js";

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy; use the real client IP for rate limits
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// CLIENT_ORIGIN can be a comma-separated list (e.g. the Vercel URL). Unset = allow all.
const origins = process.env.CLIENT_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(origins ? { origin: origins } : {}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ name: "FairDeal API", endpoints: ["GET /health", "GET /config", "POST /extract", "POST /analyze", "POST /advise"] });
});

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

// JSON body: { deal, credit_tier, kbb_value, lang? ("en" | "es") }. Returns score, flags, savings, counteroffer.
app.post("/analyze", (req, res) => {
  const { deal, credit_tier, kbb_value, lang } = req.body ?? {};
  if (!deal || typeof deal !== "object") return res.status(400).json({ error: "Missing deal." });
  try {
    res.json(analyze(deal, { creditTier: credit_tier, kbbValue: kbb_value, lang }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Personal research and plan. JSON body: { deal, credit_tier, kbb_value, lang?, profile? }
// profile: { zip?, monthly_income?, keep_years?, notes? }. Responds with server-sent events:
// "search" { query }, "source" { url, title }, "report" {...}, "error" { error }, then "done".
const adviseLimit = rateLimit({
  max: Number(process.env.ADVISE_LIMIT_PER_HOUR || 12),
  windowMs: 60 * 60 * 1000,
  message: "You've run a lot of research in the last hour. Try again later.",
});
app.post("/advise", adviseLimit, async (req, res) => {
  const { deal, credit_tier, kbb_value, lang, profile = {} } = req.body ?? {};
  if (!deal || typeof deal !== "object") return res.status(400).json({ error: "Missing deal." });
  let analysis;
  try {
    analysis = analyze(deal, { creditTier: credit_tier, kbbValue: kbb_value, lang });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const cleanProfile = {
    zip: String(profile.zip ?? "").replace(/[^0-9]/g, "").slice(0, 5),
    monthly_income: Number(String(profile.monthly_income ?? "").replace(/[$,]/g, "")) || null,
    keep_years: Number(profile.keep_years) || null,
    notes: String(profile.notes ?? "").slice(0, 500),
  };

  const stream = openStream(req, res);
  try {
    const report = await runAdvisor(
      { deal: analysis.deal, analysis, profile: cleanProfile, lang: analysis.inputs.lang },
      stream.send,
      stream.signal,
    );
    stream.send("report", report);
  } catch (err) {
    if (!stream.signal.aborted) {
      console.error("advise failed:", err);
      const message = err instanceof Anthropic.APIError
        ? `Claude API error (${err.status ?? "network"}). Try again in a moment.`
        : err.message || "Research failed. Try again.";
      stream.send("error", { error: message });
    }
  } finally {
    stream.send("done", {});
    stream.end();
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ error: "File is too large (10 MB max)." });
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`FairDeal server on http://localhost:${port}`));
