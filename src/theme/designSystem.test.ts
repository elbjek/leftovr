import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The design system's guardrail.
 *
 * Every rule here was a real pattern in this codebase before the migration:
 * 77 hand-written font families, 71 no-op font weights, four tokens holding
 * one gold, and radii that drifted off the scale. None of that is caught by
 * tsc or by eslint. This is the only thing that keeps it from coming back.
 *
 * A legitimate exception goes in ALLOWED below, with the reason. An
 * exception without a reason is the start of the next drift.
 */

const SRC = join(__dirname, "..");

/** Files that may break a rule, and why. */
const ALLOWED: Record<string, string[]> = {
  "theme/tokens.ts": ["hex", "fontSize", "radius", "fontWeight"],
  // The one place raw values are the point: it names them.
  "theme/designSystem.test.ts": ["hex", "fontSize", "radius", "fontWeight"],
  // Renders to a shared image at an arbitrary pixel size, so its type is
  // sized in its own unit rather than the app's scale.
  "components/features/ShareCard.tsx": ["fontSize", "radius"],
  // Third-party brand colours: Google's button spec fixes them.
  "components/features/AuthLanding.tsx": ["hex"],
  // Artwork. These are drawings, not chrome.
  "components/illustrations": ["hex", "radius"],
  // iOS tab bars run ~10px, below the content scale (see the file's comment).
  "app/(tabs)/_layout.tsx": ["fontSize"],
  // The component gallery renders raw values on purpose, to show them.
  "app/gallery.tsx": ["hex", "fontSize", "radius"],
  // A six-character invite code, set wide on purpose so it reads as a code.
  "app/(onboarding)/invite.tsx": ["fontSize"],
  // A flag emoji's glyph size, not type.
  "app/(onboarding)/language.tsx": ["fontSize"],
  // The onboarding tour's display figures (72, 30, 26) are one-off artwork
  // sized to the slide, not steps on the reading scale.
  "components/features/FeatureShowcase.tsx": ["fontSize"],
  // The raw OCR dump, set in the platform monospace face.
  "components/features/ReceiptConfirmList.tsx": ["fontSize"],
};

type Rule = { name: string; pattern: RegExp; why: string };

const RULES: Rule[] = [
  {
    name: "hex",
    pattern: /["'`]#[0-9a-fA-F]{3,8}["'`]/g,
    why: "colour literal — use a token from theme/tokens.ts",
  },
  {
    name: "fontSize",
    pattern: /\bfontSize:\s*\d/g,
    why: "raw font size — use a Text variant",
  },
  {
    name: "fontWeight",
    pattern: /\bfontWeight:\s*["']/g,
    why: "font weight is a no-op beside a named font cut — use Text's weight prop",
  },
  {
    name: "radius",
    // Up to 4 is a dot, a progress bar or a hairline shape, not a surface.
    pattern: /\bborder(?:\w*)Radius:\s*(?:[5-9]|\d\d+)/g,
    why: "raw corner radius — use a value from radii",
  },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "test-stubs" ? [] : walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function allowanceFor(relative: string) {
  const match = Object.keys(ALLOWED).find((key) => relative.startsWith(key));
  return match ? ALLOWED[match] : [];
}

describe("design system", () => {
  const files = walk(SRC);

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const rule of RULES) {
    it(`has no ${rule.name}: ${rule.why}`, () => {
      const offenders: string[] = [];

      for (const file of files) {
        const relative = file.slice(SRC.length + 1);
        if (allowanceFor(relative).includes(rule.name)) continue;

        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(rule.pattern)) {
          const line = source.slice(0, match.index).split("\n").length;
          offenders.push(`${relative}:${line}  ${match[0]}`);
        }
      }

      expect(offenders, `${rule.why}\n  ${offenders.join("\n  ")}`).toEqual([]);
    });
  }
});
