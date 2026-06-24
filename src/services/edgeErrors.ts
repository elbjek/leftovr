// Reads the `error` code from a Supabase FunctionsHttpError. supabase-js exposes
// the failed Response as `err.context`; the JSON body carries our `{ error }` code.
export async function readEdgeErrorCode(err: unknown): Promise<string | null> {
  const ctx = (err as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    const body = (await ctx.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
