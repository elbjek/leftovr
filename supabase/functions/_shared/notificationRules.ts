export type InventoryGroup = { name: string; urgency: string };
export type DailySuggestion = { title: string; body: string; items: string[] };

// Local wall-clock parts for an instant in a given IANA tz, via Intl (no deps).
function tzParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday,                       // "Sun".."Sat"
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isWithinSendWindow(now: Date, start: string, end: string, tz: string): boolean {
  const { minutes } = tzParts(now, tz);
  return minutes >= hhmmToMinutes(start) && minutes < hhmmToMinutes(end);
}

export function isRecapDay(now: Date, tz: string): boolean {
  return tzParts(now, tz).weekday === "Sun";
}

export function localDateKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date); // YYYY-MM-DD
}

export function sentToday(rows: { sent_at: string }[], now: Date, tz: string): boolean {
  const today = localDateKey(now, tz);
  return rows.some((r) => localDateKey(new Date(r.sent_at), tz) === today);
}

export function coalesceOpen(lastSentAt: string | null, now: Date, windowMinutes: number): boolean {
  if (!lastSentAt) return true;
  const diffMin = (now.getTime() - new Date(lastSentAt).getTime()) / 60000;
  return diffMin >= windowMinutes;
}

export function buildDailySuggestion(
  groups: InventoryGroup[],
  primaryGoal: string | null,
): DailySuggestion | null {
  const urgent = groups.filter((g) => g.urgency === "urgent").map((g) => g.name);
  const useSoon = groups.filter((g) => g.urgency === "use_soon").map((g) => g.name);
  const priority = [...urgent, ...useSoon];
  if (priority.length === 0) return null;

  const top = priority.slice(0, 3);
  const title =
    primaryGoal === "money" ? "Save money tonight"
    : primaryGoal === "quick" ? "Quick dinner idea"
    : "Use it before it goes";

  return {
    title,
    body: `Tonight: cook with ${top.join(", ")}${priority.length > 3 ? ` and ${priority.length - 3} more` : ""}.`,
    items: top,
  };
}
