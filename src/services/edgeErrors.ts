// Transport-level noise that means nothing to a user; anything matching this
// is replaced by the caller's localized fallback instead of leaking to the UI.
const NOISY_MESSAGE =
  /non-2xx|failed to fetch|network request failed|fetch failed|failed to send a request/i;

// The subset of the noise above that means "the request never reached the
// server" — worth saying out loud, because retrying later actually helps.
const OFFLINE_MESSAGE =
  /failed to fetch|network request failed|fetch failed|failed to send a request/i;

/** True when the request never left the device (no connection, DNS, timeout). */
export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : null;
  return msg !== null && OFFLINE_MESSAGE.test(msg);
}

/** A user-showable message: the error's own message when it's meaningful,
 *  else `offlineFallback` for a dead connection, else the localized fallback. */
export function friendlyMessage(err: unknown, fallback: string, offlineFallback?: string): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof (err as { message?: unknown } | null)?.message === "string"
        ? (err as { message: string }).message
        : null;
  if (msg && msg.length > 0 && !NOISY_MESSAGE.test(msg)) return msg;
  return offlineFallback && isOfflineError(err) ? offlineFallback : fallback;
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
