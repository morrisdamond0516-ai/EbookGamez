/**
 * Compare non-streaming vs streaming gpt-5.2 chapter calls.
 * Hypothesis: long non-stream completions get socket-closed (~60s) by network path.
 */
import "./load-env.ts";
import OpenAI from "openai";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 300_000,
  maxRetries: 0,
});

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 708));
const outline = (d?.outline || "").slice(0, 8000);
const messages = [
  {
    role: "system" as const,
    content:
      "You are a bestselling mystery thriller author. Write rich literary prose with natural dialogue.",
  },
  {
    role: "user" as const,
    content: `Write Chapter 1 of "The Neighbor's Lie" (~1800 words).\n\nOUTLINE:\n${outline}`,
  },
];

console.log("Prompt chars:", messages[0].content.length + messages[1].content.length);

console.log("\n--- Test A: non-streaming ---");
{
  const t0 = Date.now();
  try {
    const r = await client.chat.completions.create({
      model: "gpt-5.2",
      messages,
      max_completion_tokens: 6000,
    });
    const text = r.choices[0]?.message?.content || "";
    console.log("A OK", Date.now() - t0, "ms words", text.split(/\s+/).length);
  } catch (e: any) {
    console.log(
      "A FAIL",
      Date.now() - t0,
      "ms:",
      e.message,
      "| nested:",
      e.cause?.cause?.code || e.cause?.code || e.cause?.message,
    );
  }
}

console.log("\n--- Test B: streaming ---");
{
  const t0 = Date.now();
  try {
    const stream = await client.chat.completions.create({
      model: "gpt-5.2",
      messages,
      max_completion_tokens: 6000,
      stream: true,
    });
    let text = "";
    let chunks = 0;
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content || "";
      if (delta) {
        text += delta;
        chunks++;
        if (chunks === 1) console.log("B first token at", Date.now() - t0, "ms");
      }
    }
    console.log("B OK", Date.now() - t0, "ms words", text.split(/\s+/).length, "chunks", chunks);
  } catch (e: any) {
    console.log(
      "B FAIL",
      Date.now() - t0,
      "ms:",
      e.message,
      "| nested:",
      e.cause?.cause?.code || e.cause?.code || e.cause?.message,
    );
  }
}

console.log("\n=== Done ===");
