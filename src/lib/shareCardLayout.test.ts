import { describe, expect, it } from "vitest";

import {
  BLOCK_GAP,
  bodyPlan,
  DISH_HEIGHT,
  fixedHeight,
  ITEM_COLUMNS,
  MARKS_HEIGHT,
  printHeight,
  ROW_GAP,
  ROW_HEIGHT,
  type ShareFormat,
} from "./shareCardLayout";

// The receipt's body is the only part that can give way. If its budget is
// wrong the print overflows the paper and loses its barcode, so every card
// is checked against the height it really has, in both formats.
const FORMATS: ShareFormat[] = ["post", "story"];
/** One line at 7u, and the two-line worst case the header allows. */
const TITLE = 7 * 1.15;
const TALL_TITLE = 2 * 7 * 1.15;

function bodyHeight(plan: ReturnType<typeof bodyPlan>) {
  const blocks = [
    plan.marks ? MARKS_HEIGHT : 0,
    plan.dishes * DISH_HEIGHT,
    plan.totals * ROW_HEIGHT,
    (plan.items / ITEM_COLUMNS) * ROW_HEIGHT,
  ];
  const printed = (plan.marks ? 1 : 0) + plan.dishes + plan.totals + plan.items / ITEM_COLUMNS;
  return blocks.reduce((total, block) => total + block, 0) + Math.max(0, printed - 1) * ROW_GAP;
}

describe("share receipt layout", () => {
  for (const format of FORMATS) {
    const room = (title: number) => printHeight(format) - fixedHeight(title);

    it(`prints the rescued items inside a ${format}`, () => {
      const plan = bodyPlan(format, TITLE, { items: true });
      expect(plan.items).toBeGreaterThanOrEqual(8);
      expect(bodyHeight(plan)).toBeLessThanOrEqual(room(TITLE));
    });

    it(`prints three dinners inside a ${format}`, () => {
      const plan = bodyPlan(format, TITLE, { dishes: 3, totals: 2 });
      expect(plan.dishes).toBe(3);
      expect(bodyHeight(plan)).toBeLessThanOrEqual(room(TITLE));
    });

    it(`prints the streak strip inside a ${format}`, () => {
      const plan = bodyPlan(format, TITLE, { marks: true, totals: 2 });
      expect(plan.marks).toBe(true);
      expect(plan.totals).toBe(2);
      expect(bodyHeight(plan)).toBeLessThanOrEqual(room(TITLE));
    });

    it(`prints three totals inside a ${format}`, () => {
      const plan = bodyPlan(format, TITLE, { totals: 3 });
      expect(plan.totals).toBe(3);
      expect(bodyHeight(plan)).toBeLessThanOrEqual(room(TITLE));
    });

    it(`still fits with a two-line title on a ${format}`, () => {
      for (const want of [{ items: true }, { dishes: 3, totals: 2 }, { marks: true, totals: 2 }, { totals: 3 }]) {
        expect(bodyHeight(bodyPlan(format, TALL_TITLE, want))).toBeLessThanOrEqual(room(TALL_TITLE));
      }
    });
  }

  it("leaves room for the body on both formats", () => {
    for (const format of FORMATS) expect(printHeight(format) - fixedHeight(TALL_TITLE)).toBeGreaterThan(BLOCK_GAP);
  });
});
