import { execFileSync } from "node:child_process";
import { it } from "vitest";

// landing/sr/index.html is generated from landing/index.html and committed.
// This fails when someone edits the landing and forgets to regenerate it.
it("landing/sr/index.html is up to date (node scripts/build-landing-sr.mjs)", () => {
  execFileSync("node", ["scripts/build-landing-sr.mjs", "--check"], { stdio: "pipe" });
});
