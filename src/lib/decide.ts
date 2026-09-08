import OpenAI from "openai";

/**
 * Asks the model one question and forces the answer into exactly YES or NO.
 * Same discipline as any other untrusted-external-call: constrain the
 * output shape, validate what comes back, and never let free text leak
 * through as if it were a valid decision.
 */

export interface DecisionResult {
  decision: "YES" | "NO";
  raw: string;
}

const SYSTEM_PROMPT = `You are a binary decision engine inside an automated workflow.
You will be given a question or instruction. Respond with exactly one word:
YES or NO. Nothing else -- no punctuation, no explanation, no extra
whitespace. If you are unsure, make your best judgement and still answer
with exactly one of those two words.`;

function parseDecision(text: string): "YES" | "NO" | null {
  const cleaned = text.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (cleaned === "YES") return "YES";
  if (cleaned === "NO") return "NO";
  // Tolerate a model that answers in a short sentence, e.g. "Yes, it is."
  if (/^YES\b/.test(text.trim().toUpperCase())) return "YES";
  if (/^NO\b/.test(text.trim().toUpperCase())) return "NO";
  return null;
}

function stubDecision(prompt: string): DecisionResult {
  // Deterministic (same prompt -> same answer) so a demo run without an
  // API key is still reproducible, not random noise.
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash * 31 + prompt.charCodeAt(i)) | 0;
  }
  const decision = Math.abs(hash) % 2 === 0 ? "YES" : "NO";
  return { decision, raw: `[stub, no OPENAI_API_KEY set] ${decision}` };
}

export async function decide(prompt: string): Promise<DecisionResult> {
  if (!process.env.OPENAI_API_KEY) {
    return stubDecision(prompt);
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 20_000,
    maxRetries: 0,
  });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const attempt = async (extra?: string): Promise<string> => {
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: extra ? `${prompt}\n\n${extra}` : prompt },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  };

  const first = await attempt();
  const parsedFirst = parseDecision(first);
  if (parsedFirst) return { decision: parsedFirst, raw: first };

  // One repair attempt: tell it exactly what went wrong.
  const second = await attempt(
    `Your previous answer ("${first}") was not exactly YES or NO. Answer again with exactly one word: YES or NO.`
  );
  const parsedSecond = parseDecision(second);
  if (parsedSecond) return { decision: parsedSecond, raw: second };

  throw new Error(`Model did not return YES or NO after repair attempt. Last raw output: ${second || first}`);
}
