// How a share card divides its height. Pure, so the sums that keep the card
// from overflowing can be checked in a test (ShareCard draws the result).

/** Instagram post (4:5) or story (9:16). */
export type ShareFormat = "post" | "story";

/** Exported image size per format, in pixels. */
export const SHARE_IMAGE: Record<ShareFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/**
 * Instagram's story safe area on 1080×1920: the top 250px (profile, progress
 * bar) and the bottom 340px (reply bar) stay clear of text.
 */
export const STORY_SAFE = { top: 250 / 1920, bottom: 340 / 1920 };
/** Side padding, and the width the content gets, both in `u` (1% of the width). */
export const PAD = 7;
export const INNER = 100 - PAD * 2;
/** Gap between the blocks of the card, and between food tiles. */
export const BODY_GAP = 3;
export const TILE_GAP = 2;
/** Never more tiles than this, however much room there is. */
export const GRID_MAX = 24;
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

/** The height the content area has, in `u`. */
export function contentHeight(format: ShareFormat) {
  const height = cardHeight(format);
  return format === "story" ? height * (1 - STORY_SAFE.top - STORY_SAFE.bottom) : height - PAD * 2;
}

export type FixedBlocks = {
  /** The title's height in `u` (its size × lines). */
  titleHeight: number;
  chipRows: number;
  money: boolean;
  listRows: number;
  figures: boolean;
};

/**
 * How much height (in `u`) everything but the food grid takes: the logo, the
 * eyebrow, the title, whichever blocks the card was given, and the footer.
 */
export function fixedHeight(blocks: FixedBlocks) {
  const heights = [
    7.5, // logo
    4.2, // eyebrow
    blocks.titleHeight,
    8.2, // footer and its margin
  ];
  let gaps = 1; // eyebrow → title
  if (blocks.chipRows > 0) {
    heights.push(blocks.chipRows * 6.9 + (blocks.chipRows - 1) * 1.6);
    gaps += 1;
  }
  if (blocks.listRows > 0) {
    heights.push(blocks.listRows * 13.7 + (blocks.listRows - 1) * 2);
    gaps += 1;
  }
  if (blocks.money) heights.push(26.7);
  if (blocks.figures) heights.push(20.8);
  return heights.reduce((total, height) => total + height, 0) + gaps * BODY_GAP;
}

/** Columns for the food grid: bigger tiles while there are few foods. */
function gridColumns(count: number) {
  return count <= 8 ? 4 : 6;
}

/**
 * How many food tiles fit under everything else, and how big they are (both
 * in `u`). The grid is the only block that gives way; without this the body
 * overflows and paints over the logo and the figures.
 */
export function gridPlan(format: ShareFormat, count: number, blocks: FixedBlocks) {
  const cols = gridColumns(count);
  if (count === 0) return { cols, tile: 0, slots: 0 };
  const tile = (INNER - TILE_GAP * (cols - 1)) / cols;
  const budget = contentHeight(format) - fixedHeight(blocks) - (count > 0 ? BODY_GAP : 0);
  const rows = Math.max(0, Math.floor((budget + TILE_GAP) / (tile + TILE_GAP)));
  return { cols, tile, slots: Math.min(GRID_MAX, cols * rows) };
}
