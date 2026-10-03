# Replace browser and sharing artwork with the supplied Medic Connect mark

## Scope
- Use the uploaded Medic Connect mark as the single source for the browser favicon, Apple touch icon and installed-app icons.
- Replace the current default social preview artwork with a 1200 × 630 share image built from the same mark on a clean white canvas.
- Keep existing metadata URLs and manifest paths stable, so no page-level SEO or routing changes are required.
- Do not change visible site logos, Care workflows, Talent/Workforce lifecycle, page layouts or copy.

## Implementation
1. Render the supplied SVG into correctly padded square assets for:
   - `favicon.png`
   - `favicon.ico` at standard browser sizes
   - `apple-touch-icon.png` at 180 × 180
   - PWA icons at 192 × 192 and 512 × 512
2. Render a lightweight 1200 × 630 `social-cover.jpg` with the supplied mark centred and fully visible, without stretching or cropping it.
3. Retain the current favicon, manifest, Organization schema, Open Graph and Twitter references because they already point to these stable public filenames.

## Verification
- Confirm every generated file has the required dimensions and format.
- Check the favicon, Apple/PWA icons and social preview visually against the uploaded source.
- Verify the manifest and metadata still resolve to the replaced files.
- Run the normal build check and confirm no unrelated files changed.

The metadata update will appear on the live site after the next publish. Social platforms may retain their previous cached preview until they re-fetch it.
