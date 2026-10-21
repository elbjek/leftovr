import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isWithinSendWindow,
  isRecapDay,
  buildDailySuggestion,
  sentToday,
  coalesceOpen,
  urgencyFromExpiry,
} from "./notificationRules.ts";

Deno.test("isWithinSendWindow true when now inside window in tz", () => {
  const now = new Date("2026-06-19T11:30:00Z"); // 13:30 +02:00
  assertEquals(isWithinSendWindow(now, "13:00", "14:00", "Europe/Belgrade"), true);
});

Deno.test("isWithinSendWindow false when now outside window", () => {
  const now = new Date("2026-06-19T20:00:00Z"); // 22:00 +02:00
  assertEquals(isWithinSendWindow(now, "13:00", "14:00", "Europe/Belgrade"), false);
});

Deno.test("isRecapDay true only on Sunday in tz", () => {
  const sunday = new Date("2026-06-21T11:30:00Z"); // Sunday 13:30 +02:00
  const monday = new Date("2026-06-22T11:30:00Z");
  assertEquals(isRecapDay(sunday, "Europe/Belgrade"), true);
  assertEquals(isRecapDay(monday, "Europe/Belgrade"), false);
});

Deno.test("buildDailySuggestion returns null with no priority items", () => {
  assertEquals(buildDailySuggestion([], "money"), null);
});

Deno.test("buildDailySuggestion frames by goal and lists top items", () => {
  const out = buildDailySuggestion(
    [{ name: "spinach", urgency: "urgent" }, { name: "eggs", urgency: "use_soon" }],
    "money",
  );
  assertEquals(out?.title, "Save money tonight");
  assertEquals(out?.items, ["spinach", "eggs"]);
});

Deno.test("sentToday true when a row exists for today in tz", () => {
  const now = new Date("2026-06-19T11:30:00Z");
  const rows = [{ sent_at: "2026-06-19T08:00:00Z" }];
  assertEquals(sentToday(rows, now, "Europe/Belgrade"), true);
  assertEquals(sentToday([], now, "Europe/Belgrade"), false);
});

Deno.test("coalesceOpen false when sent within window minutes", () => {
  const now = new Date("2026-06-19T12:00:00Z");
  assertEquals(coalesceOpen("2026-06-19T11:55:00Z", now, 10), false); // 5 min ago
  assertEquals(coalesceOpen("2026-06-19T11:40:00Z", now, 10), true);  // 20 min ago
  assertEquals(coalesceOpen(null, now, 10), true);
});

Deno.test("urgencyFromExpiry matches client thresholds; past-date items are never pushed", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  assertEquals(urgencyFromExpiry(null, now), "fresh");
  assertEquals(urgencyFromExpiry("2026-10-21", now), "urgent");   // today
  assertEquals(urgencyFromExpiry("2026-10-22", now), "urgent");   // ~1.5d left
  assertEquals(urgencyFromExpiry("2026-10-24", now), "use_soon"); // ~3.5d left
  assertEquals(urgencyFromExpiry("2026-10-25", now), "use_soon"); // ~4.5d left
  assertEquals(urgencyFromExpiry("2026-10-26", now), "fresh");    // ~5.5d left
  assertEquals(urgencyFromExpiry("2026-10-20", now), "expired");  // past date: client grace, no push
  assertEquals(urgencyFromExpiry("2026-10-17", now), "expired");
});

Deno.test("isWithinSendWindow: window not on the hour opens in the hour it starts (C11)", () => {
  const run = new Date("2026-06-19T11:00:00Z"); // 13:00 +02:00
  assertEquals(isWithinSendWindow(run, "13:30", "14:00", "Europe/Belgrade"), true);
  assertEquals(isWithinSendWindow(new Date("2026-06-19T12:00:00Z"), "13:30", "14:00", "Europe/Belgrade"), false); // 14:00
});

Deno.test("isWithinSendWindow: windows may cross midnight (C11)", () => {
  const tz = "Europe/Belgrade"; // +02:00 in June
  assertEquals(isWithinSendWindow(new Date("2026-06-19T21:00:00Z"), "22:00", "07:00", tz), true);  // 23:00
  assertEquals(isWithinSendWindow(new Date("2026-06-19T01:00:00Z"), "22:00", "07:00", tz), true);  // 03:00
  assertEquals(isWithinSendWindow(new Date("2026-06-19T05:00:00Z"), "22:00", "07:00", tz), false); // 07:00
  assertEquals(isWithinSendWindow(new Date("2026-06-19T10:00:00Z"), "22:00", "07:00", tz), false); // 12:00
  assertEquals(isWithinSendWindow(new Date("2026-06-19T19:00:00Z"), "21:30", "22:00", tz), true);  // 21:00 run
});
