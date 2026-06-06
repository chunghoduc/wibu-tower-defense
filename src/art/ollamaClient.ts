/**
 * Minimal Ollama client — POST /api/generate, non-streaming, with a timeout.
 * Throws on non-200 or timeout so the orchestrator can retry.
 */
export interface GenerateOptions {
  model: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  host?: string;
}

export async function generate(opts: GenerateOptions): Promise<string> {
  const host = opts.host ?? "http://localhost:11434";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        stream: false,
        options: { temperature: opts.temperature ?? 0.7 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = (await res.json()) as { response?: string };
    return json.response ?? "";
  } finally {
    clearTimeout(timeout);
  }
}
