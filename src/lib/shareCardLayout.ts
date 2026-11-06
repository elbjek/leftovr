// How the share receipt divides its height. Pure, so the sums that keep the
// card from overflowing can be checked in a test (ShareCard draws them).
// Every size is in `u`: 1% of the card's width.

/** Instagram post (4:5) or story (9:16). */
export type ShareFormat = "post" | "story";

/** Exported image size per format, in pixels. */
export const SHARE_IMAGE: Record<ShareFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/**
 * Instagram's story safe area on 1080×1920: the top 250px (profile, progress
 * bar) and the bottom 340px (reply bar) stay clear.
 */
export const STORY_SAFE = { top: 250 / 1920, bottom: 340 / 1920 };

/** The green frame around the paper. */
export const FRAME = 4;
/** The paper's own padding. */
export const PAPER_X = 7;
export const PAPER_Y = 4;
/** The width a line of the receipt gets. */
export const INNER = 100 - (FRAME + PAPER_X) * 2;
/** Height of the torn edge at each end of the paper. */
export const TEETH = 2.4;
/** Gap between the receipt's blocks. */
export const BLOCK_GAP = 2.4;
/** One printed line of the receipt, and the gap between lines. */
export const ROW_HEIGHT = 6.4;
export const ROW_GAP = 1.2;
/** A ranked dish takes two lines; the streak's punch strip takes this much. */
export const DISH_HEIGHT = 10;
export const MARKS_HEIGHT = 12;
/** Item lines print two to a row; a receipt this wide can carry it. */
export const ITEM_COLUMNS = 2;
/** Nunito Sans ExtraBold's average letter width, as a share of the font size. */
const AVG_LETTER = 0.56;

/** Lines `text` takes at `size` across `width` (all in `u`). */
export function lineCount(text: string, size: number, width = INNER) {
  return Math.max(1, Math.ceil((text.length * AVG_LETTER * size) / width));
}

/**
 * The font size (in `u`) that keeps `text` within `lines` lines, shrinking
 * from `size` to no less than 70% of it. iOS shrink-to-fit mismeasures after
 * a re-render, so the size is settled here instead.
 */
export function fitSize(text: string, size: number, lines: number, width = INNER) {
  let found = size;
  while (found > size * 0.7 && lineCount(text, found, width) > lines) found *= 0.95;
  return found;
}

/** The card's height in `u`. */
export function cardHeight(format: ShareFormat) {
  return format === "story" ? 1600 / 9 : 125;
}

/** Where the paper sits inside the card: on a story it keeps the safe area clear. */
export function paperInset(format: ShareFormat) {
  const height = cardHeight(format);
  return format === "story"
    ? { top: height * STORY_SAFE.top, bottom: height * STORY_SAFE.bottom }
    : { top: FRAME, bottom: FRAME };
}

/** The height the printed area has, in `u`. */
export function printHeight(format: ShareFormat) {
  const inset = paperInset(format);
  return cardHeight(format) - inset.top - inset.bottom - (PAPER_Y + TEETH) * 2;
}

/**
 * Everything but the body: the header (logo, kicker, title), the two rules,
 * the gold total, the barcode and the footnote, and the gaps between them.
 */
export function fixedHeight(titleHeight: number) {
  const header = 7.5 + 1.5 + 4.2 + 1.5 + titleHeight;
  const rules = 2 * 1.4;
  const total = 18;
  const foot = 5 + 2 + 4.2;
  return header + rules + total + foot + BLOCK_GAP * 5;
}

export type BodyWant = { marks?: boolean; dishes?: number; totals?: number; items?: boolean };

/**
 * What fits in the body, in the order the receipt prints it. The body is the
 * only part that gives way, so everything in it is budgeted here: without
 * this the print overflows its paper and the barcode is cut off.
 */
export function bodyPlan(format: ShareFormat, titleHeight: number, want: BodyWant) {
  let left = printHeight(format) - fixedHeight(titleHeight);
  let printed = 0;
  const take = (height: number, max: number) => {
    let taken = 0;
    while (taken < max) {
      const cost = height + (printed > 0 ? ROW_GAP : 0);
      if (cost > left) break;
      left -= cost;
      printed += 1;
      taken += 1;
    }
    return taken;
  };
  const marks = want.marks ? take(MARKS_HEIGHT, 1) > 0 : false;
  const dishes = take(DISH_HEIGHT, want.dishes ?? 0);
  const totals = take(ROW_HEIGHT, want.totals ?? 0);
  const items = want.items ? take(ROW_HEIGHT, 99) * ITEM_COLUMNS : 0;
  return { marks, dishes, totals, items };
}
