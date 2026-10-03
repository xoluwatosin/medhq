# Correct the iPhone top and bottom screen treatment

## Confirmed cause
- The latest iPhone-edge change replaced the shared navy browser canvas with `#FAF8F4` in the page metadata, installable-app manifest and the global page canvas, and removed the fixed navy top painter.
- That made Safari’s exposed top and bottom regions deliberately warm white. They now look “naked” when the visible page starts or ends with another surface.
- The page already uses `viewport-fit=cover`, has Apple web-app metadata, a standalone manifest and the required icons. This is not caused by a missing “make it an app” setting.
- A normal Safari tab always retains Safari’s own address and toolbar interface. A website can colour or visually blend with those areas, but cannot remove them. Opening the existing Home Screen version in standalone mode removes the normal Safari bars.

## Implementation

### 1. Replace one global edge colour with page-owned edge surfaces
- Keep the normal global fallback neutral rather than restoring a permanent navy band.
- Add one shared iPhone edge controller that lets each main page shell declare its top and bottom surface colours.
- Update Safari’s `theme-color` when the page changes, and restore the fallback when the page unmounts.
- Use semantic design tokens rather than hard-coded colours in page components.

### 2. Paint the actual safe areas
- Make each full-page shell extend its own visible surface behind the top sensor/status area and bottom home-indicator area.
- Public pages will continue their visible header/background into the corresponding edge.
- Pre-assessment will use its navy heading at the top and its light form surface at the bottom.
- Professional assessment, Candidate Portal and Admin will use their own established shell surfaces.
- Loading, error, invitation and sign-in states will receive the same treatment so no transition exposes the global canvas.

### 3. Keep browser and Home Screen behaviour distinct
- Retain the existing standalone manifest and Apple metadata.
- Do not force standalone behaviour or instruct visitors to install the site merely to hide a layout defect.
- Keep Safari browser controls visible in ordinary browsing, but make their tint and the page behind them visually coherent.
- Do not restore the old site-wide fixed navy strip.

### 4. Remove remaining viewport gaps
- Replace remaining full-page `100vh` fallbacks with dynamic iPhone viewport sizing where they can expose the canvas.
- Check fixed bottom actions and dialogs for safe-area coverage without adding blank padding or a second scrolling region.
- Remove the obsolete unused navy-edge component so it cannot be accidentally restored later.

## Verification and contingency
- Check the home page, Request care, pre-assessment, professional assessment, Candidate Portal and Admin at iPhone widths in both ordinary Safari dimensions and standalone dimensions.
- Verify initial load, route changes, scrolling, rubber-band overscroll, collapsed/expanded Safari bars, focused fields and the on-screen keyboard.
- Confirm the top and bottom continue the visible page surfaces with no white gap, permanent navy strip, overlap or horizontal movement.
- Confirm metadata, manifest and icons still load and that Home Screen launch uses standalone display.
- Run focused tests, the full test suite, type checking and the preview build.
- Browser emulation cannot reproduce every physical iPhone toolbar behaviour. If a physical-device check still shows Safari’s own opaque toolbar, treat that as browser chrome rather than a page gap; preserve the correct page fill and use the existing Home Screen launch only when a bar-free app presentation is desired.

## Scope
Frontend shell, safe-area and browser-colour behaviour only. No form logic, Care lifecycle, backend, permissions or desktop redesign.
