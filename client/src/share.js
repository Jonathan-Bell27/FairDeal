// Second-opinion sharing: a link that reopens this exact deal on another phone,
// and a picture of the verdict to send with it. The deal travels in the link's
// #fragment, which browsers never send to a server, and holds only the numbers
// and the car's description: no photo, no names.
import { deflateSync, inflateSync } from "fflate";
import qrcode from "qrcode-generator";
import { CREDIT_TIERS, emptyDeal } from "./api.js";
import { usd } from "./format.js";

const FIELDS = {
  vehicle: "v",
  mileage: "mi",
  vehicle_price: "p",
  apr: "a",
  term_months: "t",
  down_payment: "d",
  trade_in_allowance: "ta",
  trade_in_payoff: "tp",
  monthly_payment: "m",
  amount_financed: "af",
  total_of_payments: "tot",
};
const LISTS = { fees: "f", add_ons: "o", taxes_and_government_fees: "x" };
const HASH = "#deal=";
// Links come from other people, so cap everything a link can carry.
const MAX_CODE = 4000;
const MAX_JSON = 32768;
const MAX_TEXT = 120;
const MAX_ITEMS = 40;

const toB64url = (bytes) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const toText = (v) => String(v ?? "").slice(0, MAX_TEXT);

// "z" + raw-deflated JSON, base64url. fflate works in every browser, so links
// open on older phones too.
export function encodeShare({ deal, creditTier, kbbValue }) {
  const data = { c: creditTier };
  const kbb = toNum(kbbValue);
  if (kbb > 0) data.k = kbb;
  for (const [field, key] of Object.entries(FIELDS)) {
    const value = field === "vehicle" ? toText(deal[field]) : toNum(deal[field]);
    if (value) data[key] = value;
  }
  for (const [field, key] of Object.entries(LISTS)) {
    const items = (deal[field] ?? [])
      .filter((i) => i.name || i.amount)
      .slice(0, MAX_ITEMS)
      .map((i) => [toText(i.name), toNum(i.amount)]);
    if (items.length) data[key] = items;
  }
  return "z" + toB64url(deflateSync(new TextEncoder().encode(JSON.stringify(data)), { level: 9 }));
}

// Returns null for anything that isn't a valid share code. Every value is
// coerced to the type the app expects, so a crafted link can't break a screen.
export function decodeShare(code) {
  try {
    if (typeof code !== "string" || code[0] !== "z" || code.length > MAX_CODE) return null;
    const bytes = inflateSync(fromB64url(code.slice(1)));
    if (bytes.length > MAX_JSON) return null;
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || !CREDIT_TIERS.includes(data.c)) return null;
    const deal = emptyDeal();
    for (const [field, key] of Object.entries(FIELDS)) {
      if (data[key] != null) deal[field] = field === "vehicle" ? toText(data[key]) : toNum(data[key]);
    }
    for (const [field, key] of Object.entries(LISTS)) {
      if (!Array.isArray(data[key])) continue;
      deal[field] = data[key]
        .filter(Array.isArray)
        .slice(0, MAX_ITEMS)
        .map(([name, amount]) => ({ name: toText(name), amount: toNum(amount) }));
    }
    const kbb = toNum(data.k);
    return { deal, creditTier: data.c, kbbValue: kbb > 0 ? String(kbb) : "" };
  } catch {
    return null;
  }
}

export const shareLink = (code) => `${location.origin}${location.pathname}${HASH}${code}`;

// The share code in the current address, if the page was opened from a shared link.
export function sharedCodeInUrl() {
  return location.hash.startsWith(HASH) ? location.hash.slice(HASH.length) : null;
}

export function clearSharedCode() {
  history.replaceState(null, "", location.pathname + location.search);
}

// QR modules for a link, or null if the link is too long for a QR code.
// Low error correction keeps the code less dense, so it scans from farther
// away; a code on a clean screen doesn't need more.
export function qrMatrix(text) {
  try {
    const qr = qrcode(0, "L");
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    return { size, isDark: (row, col) => qr.isDark(row, col) };
  } catch {
    return null;
  }
}

// ---------- The share card (a 1080x1350 PNG, always the light paper look) ----------

const W = 1080;
const H = 1350;
const C = {
  paper: "#f3eee2",
  sheet: "#fffcf4",
  ink: "#1d1b17",
  muted: "#6c6455",
  rule: "#e2d8c3",
  red: "#c4281b",
  zone: { walk: "#e0322b", negotiate: "#f5b800", fair: "#1f9d55" },
  zoneText: { walk: "#c4281b", negotiate: "#a06e00", fair: "#1b7f46" },
};
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const PEN = '"Caveat Variable", cursive';

const zoneOf = (score) => (score >= 85 ? "fair" : score >= 60 ? "negotiate" : "walk");

function fit(ctx, text, maxWidth) {
  text = String(text).slice(0, 200);
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

function gauge(ctx, cx, cy, r, score) {
  const angle = (v) => Math.PI * (1 + Math.min(100, Math.max(0, v)) / 100);
  ctx.lineWidth = 36;
  for (const [key, from, to] of [["walk", 0, 59], ["negotiate", 60, 84], ["fair", 85, 100]]) {
    ctx.strokeStyle = C.zone[key];
    ctx.globalAlpha = key === zoneOf(score) ? 1 : 0.38;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle(from + 0.8), angle(to - 0.8));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const a = angle(score);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + (r - 56) * Math.cos(a), cy + (r - 56) * Math.sin(a));
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();
}

// Module edges snap to whole pixels: blurry or overlapping edges stop phone
// cameras from reading small codes, especially after a chat app recompresses them.
function drawQr(ctx, text, x, y, size) {
  const matrix = qrMatrix(text);
  if (!matrix) return false;
  const { size: n, isDark } = matrix;
  const quiet = 3;
  const cell = size / (n + quiet * 2);
  const edge = (start, i) => Math.round(start + (i + quiet) * cell);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!isDark(row, col)) continue;
      const x0 = edge(x, col);
      const y0 = edge(y, row);
      ctx.fillRect(x0, y0, edge(x, col + 1) - x0, edge(y, row + 1) - y0);
    }
  }
  return true;
}

export async function drawCard({ result, deal, link, t }) {
  await Promise.all(
    [`700 64px ${SERIF}`, `400 30px ${SANS}`, `500 30px ${MONO}`, `600 30px ${MONO}`, `600 60px ${PEN}`].map((f) =>
      document.fonts.load(f).catch(() => {}),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const left = 96;
  const right = W - 96;
  const zone = zoneOf(result.score);

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.sheet;
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.fillRect(48, 48, W - 96, H - 96);
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // Brand with its red squiggle.
  ctx.fillStyle = C.ink;
  ctx.font = `700 56px ${SERIF}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("FairDeal", left, 140);
  const brandW = ctx.measureText("FairDeal").width;
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(left + brandW * 0.45, 158);
  ctx.bezierCurveTo(left + brandW * 0.6, 146, left + brandW * 0.75, 168, left + brandW, 154);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.fillStyle = C.muted;
  ctx.font = `600 24px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(t.share.card.eyebrow.toUpperCase(), right, 136);
  ctx.textAlign = "left";

  // The car.
  ctx.fillStyle = C.ink;
  ctx.font = `600 40px ${SERIF}`;
  ctx.fillText(fit(ctx, deal.vehicle || t.share.card.car, right - left), left, 215);

  // Gauge, number and verdict.
  const cx = W / 2;
  const cy = 450;
  gauge(ctx, cx, cy, 200, result.score);
  ctx.textAlign = "center";
  ctx.fillStyle = C.zoneText[zone];
  ctx.font = `800 130px ${SERIF}`;
  ctx.fillText(String(result.score), cx, cy + 130);
  ctx.fillStyle = C.muted;
  ctx.font = `600 24px ${MONO}`;
  ctx.fillText(t.results.scoreOf, cx, cy + 170);

  const stamp = (t.results.stamp[result.verdict.key] ?? result.verdict.label).toUpperCase();
  ctx.font = `700 40px ${MONO}`;
  const sw = ctx.measureText(stamp).width + 56;
  ctx.save();
  ctx.translate(cx, cy + 235);
  ctx.rotate(-0.04);
  ctx.strokeStyle = C.zoneText[zone];
  ctx.lineWidth = 5;
  ctx.strokeRect(-sw / 2, -38, sw, 70);
  ctx.fillStyle = C.zoneText[zone];
  ctx.fillText(stamp, 0, 12);
  ctx.restore();

  // What you could keep, in red pen.
  ctx.font = `600 64px ${PEN}`;
  ctx.fillStyle = result.total_savings > 0 ? C.red : C.zoneText.fair;
  ctx.fillText(
    result.total_savings > 0 ? t.results.keep(usd(result.total_savings)) : t.results.clean,
    cx,
    cy + 345,
  );
  ctx.textAlign = "left";

  // The biggest marked lines.
  const red = result.flags
    .filter((f) => f.severity === "red" && f.dollar_impact > 0)
    .sort((a, b) => b.dollar_impact - a.dollar_impact);
  let y = cy + 420;
  ctx.font = `500 30px ${MONO}`;
  for (const f of red.slice(0, 3)) {
    const amount = `−${usd(f.dollar_impact)}`;
    const aw = ctx.measureText(amount).width;
    const label = fit(ctx, f.line?.label ?? f.title, right - left - aw - 60);
    ctx.fillStyle = C.ink;
    ctx.fillText(label, left, y);
    const lw = ctx.measureText(label).width;
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 8]);
    ctx.beginPath();
    ctx.moveTo(left + lw + 16, y - 8);
    ctx.lineTo(right - aw - 16, y - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.red;
    ctx.fillText(amount, right - aw, y);
    y += 48;
  }
  if (red.length > 3) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 26px ${SANS}`;
    ctx.fillText(t.share.card.more(red.length - 3), left, y);
  }

  // QR back to the full markup (left out if the link is too long for one).
  const qrSize = 250;
  const qrY = H - 96 - qrSize;
  const hasQr = drawQr(ctx, link, right - qrSize, qrY, qrSize);
  ctx.fillStyle = C.ink;
  ctx.font = `600 32px ${SERIF}`;
  if (hasQr) ctx.fillText(t.share.card.scan, left, qrY + 110);
  ctx.fillStyle = C.muted;
  ctx.font = `500 24px ${MONO}`;
  ctx.fillText(location.host, left, qrY + 154);
  ctx.font = `400 20px ${SANS}`;
  ctx.fillText(t.share.card.disclaimer, left, qrY + 238);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
