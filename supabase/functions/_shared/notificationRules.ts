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

// The dispatcher runs hourly at :00, so a window counts as open when it
// overlaps the coming hour — otherwise "13:30-14:00" would never match. A
// window whose end is before its start crosses midnight ("22:00-07:00") (C11).
export function isWithinSendWindow(now: Date, start: string, end: string, tz: string): boolean {
  const { minutes } = tzParts(now, tz);
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  if (s === e) return false;
  const windows: [number, number][] = e > s ? [[s, e]] : [[s, 1440], [0, e]];
  const hours: [number, number][] = minutes + 60 <= 1440
    ? [[minutes, minutes + 60]]
    : [[minutes, 1440], [0, minutes + 60 - 1440]];
  return windows.some(([ws, we]) => hours.some(([hs, he]) => ws < he && we > hs));
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

// Mirrors client `urgencyFromExpiry` (src/services/inventoryRules.ts) bands:
// ≤2 days left urgent, ≤5 use_soon. Stricter than the client past the date:
// the client keeps a 3-day "past date — check" grace (none for meat/fish),
// but anything past its date is excluded from pushes here — "needs using
// today" would be wrong for it (B3).
// ponytail: end of day is UTC, not household tz (≤ a few hours off); items
// without expires_at stay "fresh" until estimated expiry is stored server-side.
export function urgencyFromExpiry(expiresAt: string | null, now: Date): string {
  if (!expiresAt) return "fresh";
  const daysLeft = (new Date(`${expiresAt}T23:59:59Z`).getTime() - now.getTime()) / 86_400_000;
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 5) return "use_soon";
  return "fresh";
}

export function toUrgencyGroups(
  items: { name: string; expires_at: string | null }[],
  now: Date,
): InventoryGroup[] {
  return items.map((i) => ({ name: i.name, urgency: urgencyFromExpiry(i.expires_at, now) }));
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
