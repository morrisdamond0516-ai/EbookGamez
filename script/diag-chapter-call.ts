/**
 * Reproduce a chapter-sized gpt-5.2 call for #708 to see if large prompts fail.
 */
import "./load-env.ts";
import OpenAI from "openai";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180_000,
  maxRetries: 0,
});

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 708));
if (!d) {
  console.log("Draft 708 not found");
  process.exit(1);
}

const outline = (d.outline || "").slice(0, 8000);
const systemPrompt =
  "You are a team of bestselling Mystery / Thriller authors. Write rich literary prose with distinct dialogue.";
const chapterPrompt = `Write Chapter 1 of "The Neighbor's Lie" (~2000 words) with natural dialogue.

OUTLINE EXCERPT:
${outline}`;

console.log("Prompt chars:", systemPrompt.length + chapterPrompt.length);
console.log("Using model gpt-5.2, max_completion_tokens 8000");

const t0 = Date.now();
try {
  const r = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: chapterPrompt },
    ],
    max_completion_tokens: 8000,
  });
  const text = r.choices[0]?.message?.content || "";
  console.log(
    "SUCCESS in",
    Date.now() - t0,
    "ms — words:",
    text.split(/\s+/).length,
    "finish:",
    r.choices[0]?.finish_reason,
  );
} catch (e: any) {
  console.log("FAIL in", Date.now() - t0, "ms");
  console.log("message:", e.message);
  console.log("cause.message:", e.cause?.message);
  console.log("cause.code:", e.cause?.code);
  console.log("status:", e.status, "code:", e.code);
  if (e.cause?.cause) console.log("nested cause:", e.cause.cause);
}
