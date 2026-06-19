export type PushPayload = { title: string; body: string; data?: Record<string, unknown> };
type Message = { to: string; sound: "default"; title: string; body: string; data: Record<string, unknown> };

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

export function buildMessages(tokens: string[], payload: PushPayload): Message[][] {
  const messages: Message[] = tokens.map((to) => ({
    to, sound: "default", title: payload.title, body: payload.body, data: payload.data ?? {},
  }));
  const batches: Message[][] = [];
  for (let i = 0; i < messages.length; i += 100) batches.push(messages.slice(i, i + 100));
  return batches;
}

export function deadTokensFromTickets(
  tokens: string[],
  tickets: { status: string; details?: { error?: string } }[],
): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === "error" && t.details?.error === "DeviceNotRegistered") dead.push(tokens[i]);
  });
  return dead;
}

/** Sends to all tokens; returns tokens Expo reports as dead so the caller can null them. */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<string[]> {
  if (tokens.length === 0) return [];
  const dead: string[] = [];
  for (const batch of buildMessages(tokens, payload)) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => ({ data: [] }));
    const tickets = (json.data ?? []) as { status: string; details?: { error?: string } }[];
    dead.push(...deadTokensFromTickets(batch.map((m) => m.to), tickets));
  }
  return dead;
}
