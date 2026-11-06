import { describe, expect, it } from "vitest";

import { contentHeight, fixedHeight, gridPlan, type ShareFormat } from "./shareCardLayout";

// The food grid is sized from what the other blocks leave over. If that sum
// is wrong the body overflows and paints over the logo and the figures, so
// every look is checked to fit in both formats.
const FORMATS: ShareFormat[] = ["post", "story"];
// titleHeight 3 lines at 8u is the tallest title the card allows.
const LOOKS = {
  rescued: { titleHeight: 3 * 8 * 1.15, chipRows: 0, money: false, listRows: 0, figures: true },
  saved: { titleHeight: 2 * 8 * 1.15, chipRows: 0, money: true, listRows: 0, figures: true },
  streak: { titleHeight: 2 * 8 * 1.15, chipRows: 0, money: false, listRows: 0, figures: true },
  dinners: { titleHeight: 2 * 8 * 1.15, chipRows: 0, money: false, listRows: 3, figures: true },
  reward: { titleHeight: 2 * 8 * 1.15, chipRows: 2, money: true, listRows: 0, figures: true },
};

describe("share card layout", () => {
  for (const format of FORMATS) {
    for (const [look, fixed] of Object.entries(LOOKS)) {
      it(`${look} fits a ${format}`, () => {
        expect(fixedHeight(fixed)).toBeLessThanOrEqual(contentHeight(format));
      });
    }

    it(`fills the rescued grid without overflowing a ${format}`, () => {
      const fixed = LOOKS.rescued;
      const { cols, tile, slots } = gridPlan(format, 30, fixed);
      expect(slots).toBeGreaterThanOrEqual(8);
      const rows = slots / cols;
      const grid = rows * tile + (rows - 1) * 2;
      expect(fixedHeight(fixed) + 3 + grid).toBeLessThanOrEqual(contentHeight(format));
    });
  }

  it("leaves no grid when there are no foods", () => {
    expect(gridPlan("post", 0, LOOKS.saved).slots).toBe(0);
  });
});
