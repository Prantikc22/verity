import OpenAI from "openai";

/**
 * Provider-agnostic LLM surface. All model calls go through this interface so a
 * swap (OpenAI → DeepSeek → Qwen → OpenRouter → self-hosted) touches only the
 * env, never the call sites. We use the OpenAI SDK because every target here
 * speaks the OpenAI-compatible Chat Completions API — only the base URL, model,
 * and key change.
 *
 * The API key is ALWAYS read from the environment. It is never hardcoded and
 * never sent to the browser (this module is server-only).
 */
export interface LlmConfig {
  provider: string;
  model: string;
  baseUrl: string;
  configured: boolean;
}

export function llmConfig(): LlmConfig {
  return {
    provider: process.env.LLM_PROVIDER ?? "openai",
    model: process.env.LLM_MODEL ?? "gpt-4o",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    configured: Boolean(process.env.LLM_API_KEY),
  };
}

function client(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Add it to the environment (never hardcode it). " +
        "Point LLM_BASE_URL / LLM_MODEL at OpenAI, DeepSeek, Qwen, or OpenRouter.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  });
}

export interface CompleteParams {
  system: string;
  user: string;
  /** Lower = more deterministic. Generation/healing want low temps. */
  temperature?: number;
  /** Ask the provider for a JSON object response (used by self-healing). */
  json?: boolean;
}

/** Single-shot chat completion. Returns the assistant message text. */
export async function complete(params: CompleteParams): Promise<string> {
  const cfg = llmConfig();
  const res = await client().chat.completions.create({
    model: cfg.model,
    temperature: params.temperature ?? 0.2,
    ...(params.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
