import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { copy, plural, toLang } from "./pushCopy.ts";

Deno.test("toLang falls back to English", () => {
  assertEquals(toLang("sr"), "sr");
  assertEquals(toLang("en"), "en");
  assertEquals(toLang(null), "en");
  assertEquals(toLang("de"), "en");
});

Deno.test("Serbian picks one / few / many by the last digits", () => {
  const forms = (n: number) => plural("sr", n, "one", "few", "many");
  assertEquals(forms(1), "one");
  assertEquals(forms(21), "one");
  assertEquals(forms(11), "many"); // 11 is not "one"
  assertEquals(forms(2), "few");
  assertEquals(forms(24), "few");
  assertEquals(forms(13), "many"); // 12–14 are not "few"
  assertEquals(forms(5), "many");
  assertEquals(forms(0), "many");
});

Deno.test("English only has singular and plural", () => {
  assertEquals(plural("en", 1, "one", "few", "many"), "one");
  assertEquals(plural("en", 2, "one", "few", "many"), "many");
  assertEquals(plural("en", 21, "one", "few", "many"), "many");
});

Deno.test("member activity body declines the Serbian noun", () => {
  assertEquals(copy("sr").memberActivity("Lena", 1).body, "Lena je dodao/la 1 namirnicu u tvoju kuhinju.");
  assertEquals(copy("sr").memberActivity("Lena", 3).body, "Lena je dodao/la 3 namirnice u tvoju kuhinju.");
  assertEquals(copy("sr").memberActivity("Lena", 7).body, "Lena je dodao/la 7 namirnica u tvoju kuhinju.");
  assertEquals(copy("en").memberActivity("Lena", 1).body, "Lena added 1 item to your kitchen.");
  assertEquals(copy("en").memberActivity("Lena", 7).body, "Lena added 7 items to your kitchen.");
});
