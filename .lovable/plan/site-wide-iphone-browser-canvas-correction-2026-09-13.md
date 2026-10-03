# Site-wide iPhone browser canvas correction

## Scope
Correct the shared mobile platform layer only. Preserve Care lifecycle, assessment behaviour, Admin structure, public page styling and SEO content. Do not start Tranche 7.

## Implementation
1. Make Medic Connect navy the deliberate browser canvas:
   - keep `viewport-fit=cover`;
   - add light and dark `theme-color` declarations using `#26306B`;
   - set `html`, `body` and `#root` to a navy underlying background with full-width/full-height constraints and horizontal overflow protection;
   - keep each route’s existing white, warm-white, cream or desk surface above that canvas.
2. Centralise safe-area ownership in shared shells:
   - give the public header a navy safe-area backdrop without changing the visible public page surface;
   - retain only necessary inset spacing in Candidate Auth, Candidate Portal and fixed bottom controls;
   - add equivalent shared top protection to pre-assessment and assessor surfaces through their existing shared shells or one small platform wrapper;
   - remove the candidate-only theme-colour mutation hook and any duplicate browser-colour mechanisms.
3. Add manifest-only Home Screen support:
   - create `/manifest.webmanifest` with Medic Connect name, `/` start URL, standalone display, navy theme colour and an appropriate launch background;
   - create required Medic Connect icon sizes from the existing brand mark, including an Apple touch icon;
   - add the manifest and supported Apple web-app metadata to the initial document.
4. Verify that route surfaces cover the navy canvas normally, without top gaps, double insets, layout shifts or horizontal overflow.

## Verification
- Check `/`, one service page and `/portal/login` at 320, 375, 390/393 and 430px widths.
- Check the safe public pre-assessment state only if a non-sensitive fixture is available.
- Confirm manifest/icon responses, static metadata, theme colours, viewport settings and direct-route loading.
- Run focused project tests and inspect current build diagnostics.
- Report browser-emulated results separately from behaviour that still requires a physical iPhone Safari or Home Screen launch.
