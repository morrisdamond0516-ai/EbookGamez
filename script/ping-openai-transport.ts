import "./load-env.ts";
import OpenAI from "openai";

const client = new OpenAI();

console.log("Ping non-stream...");
try {
  const r = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [{ role: "user", content: "Reply with OK" }],
    max_completion_tokens: 16,
  });
  console.log("non-stream OK:", r.choices[0]?.message?.content?.slice(0, 40));
} catch (e: any) {
  console.error(
    "non-stream FAIL:",
    e?.message || e,
    e?.cause?.code || e?.cause?.cause?.code,
  );
}

console.log("Ping stream...");
try {
  const stream = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [{ role: "user", content: "Reply with OK" }],
    max_completion_tokens: 16,
    stream: true,
  });
  let c = "";
  for await (const chunk of stream) c += chunk.choices?.[0]?.delta?.content || "";
  console.log("stream OK:", c.slice(0, 40));
} catch (e: any) {
  console.error(
    "stream FAIL:",
    e?.message || e,
    e?.cause?.code || e?.cause?.cause?.code,
  );
}
