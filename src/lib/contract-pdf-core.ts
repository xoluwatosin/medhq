// The page-slicing maths behind the contract PDF, kept free of the DOM and
// canvas so the rules can be tested directly: a signature card, an execution
// page and a table row must never be cut through, and every cut should settle
// on white space.

export interface KeepWholeBlock {
  /** Top of the block in layout pixels, relative to the captured node. */
  top: number;
  /** Bottom of the block in layout pixels, relative to the captured node. */
  bottom: number;
  /** Clearance kept above the block so its label never strands at a page foot. */
  pad: number;
}

export interface SliceProbes {
  /** Is a 1px-high row of the captured bitmap empty (near enough to white)? */
  rowIsBlank?: (y: number, allowance?: number) => boolean;
  /** Is the row a full-width horizontal rule (a table's line between rows)? */
  rowIsRule?: (y: number) => boolean;
}

export interface PageSlice {
  /** Where the slice starts in the captured bitmap, in pixels. */
  offset: number;
  /** Slice height in pixels. */
  height: number;
}

export interface SliceOptions {
  /** Total captured bitmap height in pixels. */
  contentHeightPx: number;
  /** Usable bitmap height for the first page (no top margin). */
  firstPageHeightPx: number;
  /** Usable bitmap height for continuation pages (top margin reserved). */
  continuationHeightPx: number;
  /** Layout-to-bitmap scale (captured height / measured height). */
  scale?: number;
  /** Blocks that must never be split, in layout pixels. */
  keepWhole?: KeepWholeBlock[];
  probes?: SliceProbes;
}

/**
 * Walk the bitmap top to bottom and decide where each page cut lands.
 * Returns one entry per page; offsets always advance and the final slice runs
 * to the end of the content, so the caller can slice with confidence.
 */
export function computePageSlices(options: SliceOptions): PageSlice[] {
  const {
    contentHeightPx,
    firstPageHeightPx,
    continuationHeightPx,
    scale = 1,
    keepWhole = [],
    probes = {},
  } = options;
  const rowIsBlank = probes.rowIsBlank ?? (() => true);
  const rowIsRule = probes.rowIsRule ?? (() => false);

  if (!(contentHeightPx > 0) || !(firstPageHeightPx > 0) || !(continuationHeightPx > 0)) {
    return contentHeightPx > 0 ? [{ offset: 0, height: contentHeightPx }] : [];
  }

  const nearestRule = (y: number, reach: number) => {
    for (let d = 0; d <= reach; d += 1) {
      if (rowIsRule(y - d)) return y - d - 1;
      if (rowIsRule(y + d)) return y + d - 1;
    }
    return null;
  };

  const nearestGap = (y: number, reach: number, allowance: number) => {
    for (let d = 0; d <= reach; d += 1) {
      if (rowIsBlank(y - d, allowance)) return y - d;
    }
    return y;
  };

  /** Move a cut off any block it would split, then settle it on white. */
  const cutAt = (start: number, usable: number) => {
    const ideal = start + usable;
    if (ideal >= contentHeightPx) return contentHeightPx;
    const limit = start + Math.floor(usable * 0.45);
    let y = ideal;
    let snapped = false;

    for (let pass = 0; pass < 6; pass += 1) {
      let moved = false;
      for (const block of keepWhole) {
        const top = block.top * scale;
        const bottom = block.bottom * scale;
        const safe = top - block.pad;
        if (y > safe && y < bottom && safe > limit) {
          y = block.pad ? Math.floor(safe) : Math.ceil(safe);
          moved = true;
        }
      }
      if (!moved) break;
      snapped = true;
    }

    // Settle on white, but only a hair's width: a long walk would undo the
    // block alignment above.
    if (snapped) {
      const rule = nearestRule(y, 130);
      if (rule !== null && rule > limit) return Math.min(rule, ideal);
      return Math.min(nearestGap(y, 170, 8), ideal);
    }
    for (let probe = y; probe > y - 24 && probe > limit; probe -= 2) {
      if (rowIsBlank(probe)) return probe;
    }
    return Math.max(y, limit);
  };

  const slices: PageSlice[] = [];
  let offset = 0;
  let first = true;
  // Guard against a pathological block layout that cannot make progress.
  let guard = 0;
  const maxSlices = Math.max(4, Math.ceil(contentHeightPx / Math.min(firstPageHeightPx, continuationHeightPx)) + 50);

  while (offset < contentHeightPx) {
    if (++guard > maxSlices) {
      slices.push({ offset, height: contentHeightPx - offset });
      break;
    }
    const usable = first ? firstPageHeightPx : continuationHeightPx;
    const cut = cutAt(offset, usable);
    const height = Math.min(cut - offset, contentHeightPx - offset);
    if (height <= 0) {
      slices.push({ offset, height: contentHeightPx - offset });
      break;
    }
    slices.push({ offset, height });
    offset += height;
    first = false;
  }

  return slices;
}
