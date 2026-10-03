# Making Heard more interesting

Heard currently uses a thin slice of the element kit: opener, frame, buttons, fields, notice, empty state, skeleton, letter card. The pages read correctly but flat. This pass deepens the visual expression across the four areas you chose, using only the kit's own grammar.

## Colour

Palette stays exactly as it is: late navy `#16132F`, violet `#2C2552`, muted `#4A4480`, pale sky `#BFDBF7`, paper `#FBFAFF`. No new colours, no gradients.

## Logo

Right now only the infinity symbol is drawn, cropped out of the artwork. The full Heard logo is the lockup: wordmark plus infinity, with the infinity as the star of it. Changes:
- Navigation and footer carry the full lockup, not the symbol alone.
- The infinity stays the standalone element used for watermarks, confirmations and section marks.
- To get the lockup exactly right I need the original Heard logo file (SVG preferred). If you attach it I will use it as is; otherwise I will set the wordmark in the Heard typeface alongside the existing infinity and you can correct it.

## What changes

### Homepage
- Fix the cut watermark: the opening infinity is currently clipped at the section edge. It gets its own overflow-safe layer, scaled and positioned so the full shape reads at every width, mobile included.
- A proper opening statement: oversized headline with the infinity sitting behind it as a quiet, complete watermark.
- Three destination blocks (Write, Story Swap, Letters) as offset sky-framed panels with numbered index markers, not equal grey cards.
- A rotating single-line pull quote drawn from approved letters, with the plain fallback line when none exist.
- Clear section openers with rules and eyebrow labels between each band, so the page has rhythm rather than one continuous column.

### Letter Room
- Letter presented as paper: sky offset behind, hairline inner rule, index marker ("Letter 3 of 11"), signature line at the foot.
- Stack treatment behind the current letter so remaining letters are visible as layered edges.
- Pagination controls in the kit's square style alongside "One more letter".
- Richer empty and loading states: the skeleton mimics letter lines rather than a grey block.

### Write and Leave a letter
- Two-column composition on desktop (guidance left, form right), single column on mobile.
- Step markers for the write -> preview -> sent sequence on Leave a letter.
- Character counter and a calmer inline validation treatment on the textarea.
- Confirmation becomes a full moment: sky panel, mark, and one next action, not a small notice.

### Navigation and footer
- Navigation gains the kit's tab-style active state with an underline marker.
- Mobile menu becomes the kit sheet: full-height, square, large type, close control.
- Footer restructured into labelled columns with a hairline rule and the mark, ending on the safety line.

## Motion

Level 4: entrances settle rather than pop. Section openers fade and rise on scroll, letters cross-fade when advancing, the sheet slides, buttons keep the small lift. All of it disabled under reduced-motion, as now.

## Technical notes

- New CSS lives inside the existing `.heard-v2` scope in `src/index.css`.
- New primitives are added to `src/components/heard/v2/HeardKit.tsx` (stack, pagination, step markers, sheet, quote, index marker); existing exports keep their signatures.
- Pages updated: `HeardHome`, `HeardLetterRoom`, `HeardWrite`, `HeardLeaveLetter`, plus `HeardLayout` for navigation and footer. About, Support, Privacy and Talk pick up the shared styling only.
- No schema, submission-path, RLS or routing changes. `/heard-preview` and the Heard hostname model stay as they are.
- Medic Connect and the legacy `/heard` page are untouched.
- A new `HeardLogo` lockup component sits beside the existing `HeardMark`; both live in `src/components/heard/v2/`.

## Domain

Now that heard.medicconnect.co points at the project, I will check its connection status and confirm the Heard homepage serves at the root of that hostname. The code already routes on it, so no routing change is expected. Pages there will stay noindex until you say they should be indexed.

## Not in this pass

Heard admin, moderation, automated delivery, real letter content, Terms page, final privacy notice.
