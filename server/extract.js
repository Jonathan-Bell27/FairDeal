// Claude reads the photo or PDF and returns schema-valid JSON. It does not
// judge the deal; rules.js does that.

import Anthropic from "@anthropic-ai/sdk";
import { dealSchema } from "./schema.js";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export const SUPPORTED_TYPES = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
};

const PROMPT = `You are reading a car purchase document: a buyer's order, retail installment sale contract, or loan offer. It may be a phone photo taken at an angle. Extract the terms exactly as printed.

Rules:
- Copy numbers exactly as printed. Do not calculate or estimate a value that isn't on the document; use 0 (or "" for text) instead.
- apr is the annual percentage rate as a number (18.99 for 18.99%). term_months is the number of payments.
- vehicle is year, make, model, and trim as printed. mileage is the odometer reading.
- vehicle_price is the vehicle's cash/sale price before fees, add-ons, taxes, and trade-in.
- fees: dealer-charged fees such as documentary/doc fees, dealer prep, reconditioning, delivery, or dealer handling.
- add_ons: optional products such as VIN etching, nitrogen tires, paint or fabric protection, GAP, service contracts or extended warranties, GPS or starter-interrupt devices, tire and wheel plans.
- taxes_and_government_fees: sales tax, TAVT, title, tag, and registration.
- Put each line item in exactly one list. Use the name as printed.
- document_type: "Buyer's order", "Retail installment sale contract", or a short description if neither.`;

let client;
const getClient = () => (client ??= new Anthropic());

export async function extractDeal(buffer, mimeType) {
  const blockType = SUPPORTED_TYPES[mimeType];
  if (!blockType) throw new Error(`Unsupported file type: ${mimeType}`);

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Re-run on another model if a safety classifier declines the request.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: dealSchema },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: blockType,
            source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to read this document. Try manual entry.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Extraction was cut off. Try again or use manual entry.");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude returned no data. Try manual entry.");
  return JSON.parse(text);
}
