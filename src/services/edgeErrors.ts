// Transport-level noise that means nothing to a user; anything matching this
// is replaced by the caller's localized fallback instead of leaking to the UI.
const NOISY_MESSAGE =
  /non-2xx|failed to fetch|network request failed|fetch failed|failed to send a request/i;

/** A user-showable message: the error's own message when it's meaningful,
 *  else the localized fallback. */
export function friendlyMessage(err: unknown, fallback: string): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof (err as { message?: unknown } | null)?.message === "string"
        ? (err as { message: string }).message
        : null;
  return msg && msg.length > 0 && !NOISY_MESSAGE.test(msg) ? msg : fallback;
}

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
