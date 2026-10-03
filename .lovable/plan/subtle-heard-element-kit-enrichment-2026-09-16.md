# Subtle Heard element-kit enrichment

## Goal
Keep the current Heard layout, typography, bright-white page ground, navigation and copy. Add a restrained layer of the existing letter-room visual language, without turning the site into an archive interface or redesigning any page.

## Changes
- Add the workbook primitives to the existing Heard element library: `HeardTapeLabel`, `HeardLetterStack`, `HeardLetterOpened`, `HeardPinnedNote`, `HeardPostmark`, `HeardPigeonhole`, `HeardClosing` and `HeardSegmentRule`.
- Refine the current Letter Room only:
  - retain one letter at a time;
  - show a modest three-sheet stack with corner state tape and category edge tape;
  - use a simple sealed-to-opened interaction, then settle the opened letter once with its offset down-left;
  - add a restrained text-only postmark and one pinned note where useful;
  - keep “One more letter” as the existing action, presented with a light pigeonhole cue rather than a new sidebar or filing interface.
- Apply `HeardClosing` sparingly at genuine page endings: two lines and one button, unboxed, immediately before the footer.
- Use `HeardSegmentRule` at most once per selected page, near the footer, rather than repeating decorative dividers.
- Rebalance existing Heard colours so Violet Ink, Mute and Late provide more visible structure, while Bright White remains the dominant page ground and Pale Sky remains the only accent.
- Complete the Heard domain hand-off: `heard.medicconnect.co` is already active, verified and correctly pointed to Lovable, but currently redirects to `www.medicconnect.co`. Unset the project’s primary domain so each connected domain serves the app at its own address and Heard can load directly on its hostname.

## Guardrails
- No layout overhaul, dashboard treatment, sidebar, fake archive controls or invented metadata.
- No copy, routing, form, submission, security, data or backend changes.
- No changes to Medic Connect, the legacy `/heard` page, or the host-aware `/heard-preview` model.
- Do not alter DNS records; the Heard A and verification records are already correct.
- Tape stays limited to letters and the pinned-note treatment, not navigation, buttons or general cards.
- Preserve reduced-motion behaviour; the opened-letter transition becomes immediate when reduced motion is requested.

## Verification
- Check the sealed, opened, loading and empty Letter Room states on desktop and mobile.
- Confirm all nine Heard routes still render and deep-link correctly.
- Recheck `heard.medicconnect.co` after the primary-domain setting is removed, including its root and Heard deep links; confirm Medic Connect domains still serve their normal product.
- Confirm keyboard focus, readable contrast, no clipping/overlap, reduced-motion handling and no console errors.
- Run the existing tests and verify the preview build remains healthy.
