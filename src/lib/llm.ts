import OpenAI from "openai";

// A backend = an OpenAI-compatible client + a model id to call on it.
type Backend = { client: OpenAI; model: string; label: string };

let _backends: Backend[] | null = null;

function buildBackends(): Backend[] {
  const backends: Backend[] = [];

  // Preferred: OpenRouter FREE models — tried first to avoid any cost.
  // primary + fallbacks, each tried in order on error/429.
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Daily Task Assistant",
      },
    });
    const primary = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.6:free";
    const models = [
      primary,
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "z-ai/glm-4.5-air:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);
    for (const model of models) {
      backends.push({ client: openrouter, model, label: `openrouter:${model}` });
    }
  }

  // Last-resort fallback: DeepSeek official API (paid, reliable, not rate-limited).
  // Only reached when every free model above failed/was rate-limited.
  if (process.env.DEEPSEEK_API_KEY) {
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    backends.push({
      client: deepseek,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      label: "deepseek-official",
    });
  }

  return backends;
}

function backends(): Backend[] {
  if (!_backends) _backends = buildBackends();
  return _backends;
}

type ChatParams = Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model">;

// Try each backend until one returns content. Throws if all fail.
export async function chatWithFallback(params: ChatParams): Promise<string> {
  const list = backends();
  if (list.length === 0) throw new Error("no LLM backend configured");

  let lastErr: unknown = null;
  for (const b of list) {
    try {
      const completion = await b.client.chat.completions.create({ ...params, model: b.model });
      const text = completion.choices[0]?.message?.content;
      if (text && text.trim()) {
        console.log(`[llm] ✓ ${b.label}`);
        return text;
      }
    } catch (e) {
      lastErr = e;
      console.log(`[llm] ✗ ${b.label} — ${(e as Error)?.message?.slice(0, 80) || "failed"}`);
    }
  }
  throw lastErr ?? new Error("all LLM backends failed");
}
