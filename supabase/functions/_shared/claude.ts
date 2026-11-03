import Anthropic from "npm:@anthropic-ai/sdk@^1.3.0";

export { Anthropic };

export const SONNET = "claude-sonnet-5-5";
export const HAIKU = "claude-haiku-5-5";

// Every AI step in the edge functions is one Claude call that must come back
// as JSON matching a schema, so the call lives here once. Structured outputs
// guarantee the shape; the refusal / max_tokens checks catch the two cases
// where it can't.
export async function generateJson<T>(
  client: Anthropic,
  { model, system, content, schema, maxTokens, effort, timeoutMs }: {
    model: typeof SONNET | typeof HAIKU;
    system?: string;
    content: string | Anthropic.Beta.BetaContentBlockParam[];
    schema: Record<string, unknown>;
    maxTokens: number;
    effort: "low" | "medium" | "high";
    /** Bounds a paid call so a hung request fails fast instead of retrying. */
    timeoutMs?: number;
  },
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const response = await client.beta.messages.create(
    {
      model,
      max_tokens: maxTokens,
      // A safety-classifier decline is re-run on Anthropic's recommended
      // fallback model inside the same call. Haiku has no server-side
      // fallback (the parameter is rejected there).
      ...(model === SONNET
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      ...(system ? { system } : {}),
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
    },
    timeoutMs ? { timeout: timeoutMs, maxRetries: 0 } : undefined,
  );
  if (response.stop_reason === "refusal") throw new Error("model_refusal");
  if (response.stop_reason === "max_tokens") throw new Error("model_max_tokens");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("model_no_text");
  return {
    data: JSON.parse(text.text) as T,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
