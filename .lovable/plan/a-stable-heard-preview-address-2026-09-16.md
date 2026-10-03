# A stable Heard preview address

Yes, this is possible. Heard gets one set of page definitions that render at the root of `heard.medicconnect.co` and under `/heard-preview` everywhere else, with no query parameter and working deep links and refreshes.

## What changes

1. **New preview namespace.** `/heard-preview`, `/heard-preview/write`, `/heard-preview/story-swap`, `/heard-preview/letters`, `/heard-preview/letters/leave`, `/heard-preview/talk`, `/heard-preview/about`, `/heard-preview/support`, `/heard-preview/privacy` all open the Heard pages on the Lovable preview address and on `medicconnect.co`.

2. **One definition, two mount points.** The Heard pages are defined once. On the Heard hostname they mount at the root; on every other host they mount under the preview prefix. No page is duplicated.

3. **Links stay inside the namespace.** Every link inside Heard is built through a small helper that adds the current base. Inside the preview, Story Swap goes to `/heard-preview/story-swap`; on the live Heard address the same link goes to `/story-swap`. A plain `/story-swap` on a Medic Connect host stays a Medic Connect address and never becomes Heard.

4. **The query parameter goes.** `?product=heard` and `?product=medic` and the tab-pinning behind them are removed. Only the hostname decides the live product.

5. **The old `/heard` page is untouched.** It keeps working exactly as today and is not used by the new namespace. What happens to it long term stays an open decision.

6. **Medic Connect is unchanged.** Same routes, same pages, same behaviour.

7. **Documentation.** `docs/heard/architecture.md` records the production and preview addressing model and states that the query parameter has been retired.

## Technical notes

- `src/lib/heard-host.ts`: drop `readPin`, `isHeardProduct` and the session pin; keep hostname detection and export `HEARD_PREVIEW_BASE = "/heard-preview"` plus `heardBase()` returning `""` on the Heard host and the prefix elsewhere.
- Add a small `HeardBase` React context plus a `useHeardPath()` helper so Heard links and the SEO `path` prop resolve against the active base.
- `src/pages/heard/HeardRoutes.tsx`: convert route paths to relative (`""`, `"write"`, `"letters/leave"`, `"*"`) so one tree works under either mount.
- `src/App.tsx`: when the hostname is Heard, render `<HeardRoutes />` at the root as now; otherwise add a single `<Route path="/heard-preview/*" element={<HeardRoutes />} />` inside the existing Medic Connect routes and leave everything else alone.
- Update the internal links in `HeardShell.tsx` (wordmark and nav), `HeardThanks.tsx` and the privacy link in `HeardSignupForm.tsx` to use the base helper. The "Medic Connect" footer link stays an absolute `/` only on Medic Connect hosts; on the Heard host it points at the Medic Connect site.
- Heard preview routes stay `noindex` and out of the Medic Connect sitemap and AI listings; add `/heard-preview` to `public/robots.txt` disallow so the preview namespace is never crawled on `medicconnect.co`.
- Deep links and refresh work because the host serves the app shell for unknown paths and the router matches the prefix.

## Verification

- Typecheck, tests and build.
- Browser check: open each of the nine `/heard-preview` addresses directly (not by clicking), confirm each renders its Heard page after a hard refresh, and confirm in-page navigation keeps the prefix.
- Confirm `/`, `/privacy` and `/story-swap` on the Medic Connect host still show Medic Connect pages.
- Report the exact preview URL for the Heard homepage.
