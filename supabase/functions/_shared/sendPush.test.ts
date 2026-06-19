import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMessages, deadTokensFromTickets } from "./sendPush.ts";

Deno.test("buildMessages chunks tokens into <=100 batches", () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
  const batches = buildMessages(tokens, { title: "t", body: "b", data: {} });
  assertEquals(batches.length, 3);
  assertEquals(batches[0].length, 100);
  assertEquals(batches[2].length, 50);
  assertEquals(batches[0][0].title, "t");
});

Deno.test("deadTokensFromTickets returns DeviceNotRegistered tokens", () => {
  const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
  const tickets = [
    { status: "ok" },
    { status: "error", details: { error: "DeviceNotRegistered" } },
  ];
  assertEquals(deadTokensFromTickets(tokens, tickets), ["ExponentPushToken[b]"]);
});
