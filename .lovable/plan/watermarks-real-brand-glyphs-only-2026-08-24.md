# Watermarks: real brand glyphs only

The candidate hero currently draws its watermark from hand-built circles and cross bars. Those are invented shapes, not the mark. Replace them with the actual brand glyph files from the design guide, and keep the per-record variety in placement only.

## What changes

- Drop all six drawn figures (rings, cross, receding rings, stacked rings).
- Use the four real glyph files made for navy surfaces: the O, the cross, the infinity, and the whole mark.
- Vary per candidate by **which glyph** and **how it is cropped** (bottom edge rising, right edge halved, corner crop), not by drawing anything new. Same record always gets the same placement, keyed off its id.
- Opacity held at 0.10 to 0.16, per the guide.
- Nothing crosses the name or the fact rows: placements stay to the right edge and below the headline block.
- The cross, infinity, and whole mark are never cropped through their junction or crossing point, as the guide requires. Never crop the cross so hard that only its bars remain.

## Placement set

Six placements built from the four glyphs:

```text
1  O          rising from the bottom edge, centre-right
2  O          cropped at the top right corner
3  cross      large on the right edge, junction intact
4  infinity   running along the right edge
5  full mark  halved on the right edge
6  full mark  small, bottom right corner
```

## Technical notes

- Copy `m-o-soft.svg`, `m-cross-soft.svg`, `m-inf-soft.svg`, `m-full-soft.svg` from `docs/design-guide/assets/` into `src/assets/brand/` (only `m-o-soft.svg` is there today).
- Rewrite `src/components/admin/mu/heroWatermark.tsx`: remove the `Ring`/`Cross` components and the inline SVG art; each variant becomes `{ src, style }` rendered as an `<img>` with `aria-hidden`, absolutely positioned, `pointer-events-none`.
- Keep the existing `hashOf` seed function and the `MuHeroWatermark({ seed })` signature so `MatchUniversePerson.tsx` and `MuShell.tsx` need no changes.
- Verify with element screenshots of four different candidate heroes that the glyph reads as the mark and no placement sits under the name.
