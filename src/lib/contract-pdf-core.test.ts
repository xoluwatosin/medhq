// Regression tests for the contract PDF page slicing.
//
// These guard the two failures we have shipped before: a signature block or
// execution page being cut in half, and a cut landing on ink instead of white
// space. They drive computePageSlices with synthetic block positions, no DOM.
import { describe, expect, it } from "vitest";
import { computePageSlices, type KeepWholeBlock } from "@/lib/contract-pdf-core";

const PAGE = 1000;

const blankProbes = {
  // Every row is blank white: the plain case.
  rowIsBlank: () => true,
  rowIsRule: () => false,
};

describe("computePageSlices", () => {
  it("slices plain content into full pages", () => {
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      probes: blankProbes,
    });
    expect(slices).toEqual([
      { offset: 0, height: 1000 },
      { offset: 1000, height: 1000 },
      { offset: 2000, height: 500 },
    ]);
  });

  it("covers the whole content with no gaps and no overlaps", () => {
    const slices = computePageSlices({
      contentHeightPx: 3737,
      firstPageHeightPx: PAGE,
      continuationHeightPx: 940,
      probes: blankProbes,
    });
    let cursor = 0;
    for (const s of slices) {
      expect(s.offset).toBe(cursor);
      expect(s.height).toBeGreaterThan(0);
      cursor += s.height;
    }
    expect(cursor).toBe(3737);
  });

  it("moves a cut above a signature block it would split", () => {
    const signature: KeepWholeBlock = { top: 950, bottom: 1250, pad: 44 };
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      keepWhole: [signature],
      probes: blankProbes,
    });
    // The first page must end at or above the block's safe top (top - pad).
    expect(slices[0].offset + slices[0].height).toBeLessThanOrEqual(950 - 44);
    // And the block must sit whole inside a single later page.
    const covering = slices.find((s) => s.offset <= 950 && s.offset + s.height >= 1250);
    expect(covering, "a page must contain the whole signature block").toBeTruthy();
  });

  it("never cuts through a table row (pad 0 blocks)", () => {
    // Rows every 300px; the ideal cut at 1000 lands inside row 900-1200.
    const rows: KeepWholeBlock[] = [
      { top: 300, bottom: 600, pad: 0 },
      { top: 900, bottom: 1200, pad: 0 },
      { top: 1500, bottom: 1800, pad: 0 },
    ];
    const slices = computePageSlices({
      contentHeightPx: 2600,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      keepWhole: rows,
      probes: blankProbes,
    });
    for (const s of slices) {
      const cut = s.offset + s.height;
      if (cut >= 2600) continue;
      for (const r of rows) {
        const inside = cut > r.top && cut < r.bottom;
        expect(inside, `cut at ${cut} splits row ${r.top}-${r.bottom}`).toBe(false);
      }
    }
  });

  it("never strands a page below 45% full, even for a huge block", () => {
    // A block so tall it cannot fit one page: the cut moves above it only while
    // the safe edge stays past the 45% limit, otherwise the cut stands.
    const huge: KeepWholeBlock = { top: 500, bottom: 1900, pad: 44 };
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      keepWhole: [huge],
      probes: blankProbes,
    });
    // Safe edge is 500 - 44 = 456, just past the 450 limit, so the cut moves there.
    expect(slices[0].height).toBe(456);
    expect(slices[0].height).toBeGreaterThanOrEqual(Math.floor(PAGE * 0.45));
  });

  it("stands the cut when moving above the block would strand the page", () => {
    // Block starts before the 45% limit: its safe edge is below the limit, so
    // the cut is not allowed to move above it and the block is split instead.
    const early: KeepWholeBlock = { top: 400, bottom: 1600, pad: 44 };
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      keepWhole: [early],
      probes: blankProbes,
    });
    expect(slices[0].height).toBe(PAGE);
  });

  it("settles a snapped cut on the nearest table rule", () => {
    const row: KeepWholeBlock = { top: 950, bottom: 1250, pad: 0 };
    // A rule sits just above the row at y=948; rows elsewhere are not blank.
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      keepWhole: [row],
      probes: {
        rowIsBlank: () => false,
        rowIsRule: (y) => y === 948,
      },
    });
    // nearestRule returns y - 1, so the cut lands at 947, above the rule.
    expect(slices[0].height).toBe(947);
  });

  it("handles content shorter than one page", () => {
    const slices = computePageSlices({
      contentHeightPx: 400,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      probes: blankProbes,
    });
    expect(slices).toEqual([{ offset: 0, height: 400 }]);
  });

  it("respects the layout-to-bitmap scale when placing blocks", () => {
    // Block at layout 475-625, captured at 2x: bitmap 950-1250.
    const signature: KeepWholeBlock = { top: 475, bottom: 625, pad: 44 };
    const slices = computePageSlices({
      contentHeightPx: 2500,
      firstPageHeightPx: PAGE,
      continuationHeightPx: PAGE,
      scale: 2,
      keepWhole: [signature],
      probes: blankProbes,
    });
    expect(slices[0].height).toBeLessThanOrEqual(950 - 44);
    const covering = slices.find((s) => s.offset <= 950 && s.offset + s.height >= 1250);
    expect(covering).toBeTruthy();
  });
});
