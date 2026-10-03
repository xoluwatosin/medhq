# Medic Connect website, design guide for Lovable

This is a guide for implementing the Medic Connect look inside the existing website. It is not a codebase and not a page build. Everything below is either a token, a rule, or a component spec, with reference HTML in this folder to look at.

Files in this bundle:

| File | What it is |
|---|---|
| `README.md` | This guide |
| `index.html` | Contents page |
| `design-system.html` | **Start here.** The whole system embedded in one offline page |
| `reference-elements.html` | Every UI element, states included |
| `reference-sidebars.html` | Six sidebar styles with their mobile behaviour |
| `reference-footer.html` | Three footer directions, the navy anchor is the one to build |
| `reference-homepage.html` | The two audience states with the nav and the flip cards |
| `reference-flip-cards.html` | Twenty watermark placements for card backs |
| `reference-hero-backgrounds.html` | Eight watermark placements for the hero |
| `reference-body-wallpaper.html` | Eight treatments for the page behind the content |
| `reference-mobile.html` | Every piece at 375px |
| `reference-typography.html` | The type scale at real size |
| `reference-palette-icons.html` | Every colour with its hex and its job, plus the full icon set |
| `assets/` | Logo lockups and mark parts |

---

## 1. Non negotiables

- Brand name is two words, **Medic Connect**.
- No em-dashes anywhere. Commas, periods, or "to" for ranges.
- No middot separators. Use a thin vertical rule, a comma, or spacing.
- Always the real lockup, `assets/medicconnect-logo.svg`, or the white version on dark. Never the mark beside retyped "Medic Connect" text.
- **Hot red `#FF2E2E` is prices only**, plus the cross inside the logo. Never a button, a border, an alert, a heading or a link.
- Every care plan starts with a **₦35,000 home care needs assessment**. Order: client contacts us, we follow up, assessment is booked, care begins.
- Never mention HMOs or insurance.
- Never claim a total number of services.
- Service prices read `from ₦X` until the real figure is supplied.

---

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| Deep navy | `#26306B` | Hero, footers, dark panels, stat figures, urgent notices |
| Brand blue | `#3B4DC4` | Buttons, links, eyebrows, left rules, active states |
| Soft blue | `#5B6BE5` | Rare, secondary accents |
| Tint | `#EEF1FF` | Panels, photo slots, chips, quote blocks |
| Warm white | `#FAF8F4` | Page background |
| White | `#FFFFFF` | Cards, nav pill, content surfaces |
| Ink | `#1A1F2E` | Headings |
| Body grey | `#3A4152` | Body copy |
| Muted | `#6B7285` | Secondary copy |
| Label grey | `#8A90A2` | Uppercase labels, captions |
| Hairline | `#E4E1DA` | Rules on white and warm white |
| Hairline, warm | `#DDD9D1` | Rules on warm white where more contrast is needed |
| Field border | `#C9C5BC` | Input borders |
| Hairline on tint | `#D5DAF5` | Rules inside tint panels |
| Hairline on navy | `#454FA8` | Rules inside navy panels |
| Outline on navy | `#7A85D8` | Outlined buttons and numerals on navy |
| Body on navy | `#C6CBF0` | Body copy on navy |
| Muted on navy | `#A8B0E8` | Labels and legal on navy |
| Price red | `#FF2E2E` | Prices only |

Dark mode, if the site adds it: warm white to `#14161F`, tint to `#1E2340`, hairline to `#2C3040`, body to `#B9BCC8`, ink to `#F2F0EA`, links to `#8E9BFF`, price red to `#FF6B6B`. Navy stays.

The full swatch set, contrast pairings and the icon set are drawn in `reference-palette-icons.html`. Copy hex values from there, never from a screenshot.

---

## 3. Type

**Figtree only**, weights 400, 500, 600, 700. Fallback `'Helvetica Neue', Helvetica, Arial, sans-serif`.

| Role | Desktop | Mobile | Weight | Tracking |
|---|---|---|---|---|
| Display | 64 / 1.05 | 40 / 1.1 | 500 | -0.03em |
| H1 | 48 / 1.12 | 32 / 1.2 | 500 | -0.025em |
| H2 | 34 / 1.2 | 26 / 1.25 | 500 | -0.02em |
| H3 | 24 / 1.35 | 21 / 1.35 | 600 | -0.015em |
| H4, card title | 19 / 1.4 | 19 / 1.4 | 600 | -0.01em |
| Lead | 21 / 1.6 | 18 / 1.6 | 400 | none |
| Body | 17 / 1.7 | 16 / 1.7 | 400 | none |
| Small body | 15 / 1.65 | 15 / 1.65 | 400 | none |
| Eyebrow | 12, uppercase | same | 700 | 0.2em |
| Label | 11, uppercase | same | 700 | 0.16em |
| Price | 28 | 24 | 700 | -0.025em |
| Legal, caption | 13 / 1.6 | 13 / 1.6 | 400 | none |

Rules: headings in sentence case; uppercase only for eyebrows and labels; measure 60 to 70 characters; one H1 per page; emphasis by weight 600, never colour; italic reserved for pull quotes; prices use tabular numerals and always the ₦ sign, never "NGN" and never decimals.

---

## 4. Shape, spacing, motion

The uploaded `Medic_Connect_Request_Care.html` is the current source of truth for application surfaces and supersedes the former square and asymmetric analogue box treatment.

- **Corners are soft and symmetric.** Controls use 9 to 12px, cards and panels use 14 to 16px, and composed pop-ups use 22 to 24px. Pills remain fully rounded.
- One hairline weight, 1px. Borders 1.5px only on selected controls, outlined buttons and invalid fields.
- Quiet cards use a restrained neutral shadow. Composed pop-ups use the navy-tinted shadow from the Request care reference. Avoid decorative or coloured shadows.
- Section padding 50px at the page edge on desktop, 22 to 26px on mobile.
- Grid gutters 24px between cards, 20px inside cards.
- Hit areas never below 44px on touch.
- Transitions 200ms for colour and opacity, 520ms `cubic-bezier(0.2, 0.7, 0.2, 1)` for the card flip. Nothing else animates.

---

## 5. The header, chosen

**Two pills, links centred.** This is the version to build.

- Pill one: white, `border-radius: 999px`, padding 13px 26px, holding the lockup at 138px wide.
- Pill two: white, same radius, `flex: 1`, padding 11px 14px. Inside it, in order: a **spacer the width of the CTA** (152px), the links group with `flex: 1` and `justify-content: center`, then the CTA. The spacer is what keeps the links on the pill's true centre line instead of drifting under the button. Do not centre the links with absolute positioning.
- Gap between the two pills 14px. Both sit 26px from the top of the hero with 50px page padding.
- Shadow `0 10px 30px rgba(10, 14, 40, 0.24)` on navy, `0 8px 26px rgba(26, 31, 46, 0.07)` on light.
- Links: `Care at home`, `For Facilities`, `Join our network`. 15px, weight 600. Active `#1A1F2E`, resting `#3A4152`. The footer sitemap is a different, longer list (About us, How it works, Pricing, Careers and the service names); that is deliberate, not drift.
- The reference pages are drawn at a 1280 minimum. Below that the two pills are out of spec and collapse to the mobile bar described at the end of this section.
- CTA: `WhatsApp us`, brand blue fill, white text, 999px radius, padding 13px 26px, linking to `https://wa.me/2348126988237`.
- Mobile: pills collapse to a single white bar with the lockup and a hamburger; the menu is an off canvas navy drawer, 300px, dimmed page behind, WhatsApp pinned to the bottom of the drawer.

---

## 6. The hero

Navy `#26306B`, full bleed, the nav pills floating on it.

- **Care at home**: centred. Eyebrow, 68px headline (max 17 characters per line), 20px lead at max 54 characters, two buttons, then the assessment line with the fee. Fee is white on navy, not red, because red on navy goes muddy.
- **For Facilities**: two columns. Left, eyebrow, 54px headline, lead, three numbered steps. Right, a 440px white enquiry card with two fields and one button.
- Buttons on navy: primary is white fill with navy text, secondary is a 1.5px `#7A85D8` outline with white text. Use the shared 10px control radius.

**Watermark placement.** Pick one and use it everywhere; see `reference-hero-backgrounds.html` for the eight tested against the nav and headline positions.

- Assets: `m-o-soft.svg`, `m-inf-soft.svg`, `m-full-soft.svg`. These are the pale blue fills made for navy surfaces.
- Opacity 0.10 to 0.16. Below that it disappears, above it competes with the type.
- The glyph must stay recognisable: crop a circle freely, but never cut the crossing point out of the infinity or the junction out of the cross.
- Nothing may run behind the nav pill or reduce contrast under the headline block.
- Recommended: **E, O rising from the bottom edge, centred**, for the centred home hero, and **F, whole mark halved on the right edge**, for the two column facilities hero. Both keep the top half of the field clear.

---

## 7. Flip cards, the service grid

Under the hero, a section head, a hairline, then a six card grid. The set changes with the audience: the six home care services under Care at home, the six placement services under For Facilities.

- Card 300 by 340, grid gap 24px, three per row at 1280.
- **Corners:** 16px symmetric corners on both faces, matching the shared card surface.
- **Front**: white, 1px `#E4E1DA` border, the O cropped at the top right (`m-o-tint.svg`, 170px, right -52px, top -54px). Eyebrow, title at 23px weight 600, and at the foot a hint plus an arrow.
- **Back**: navy, no border, the O cropped at the bottom right (`m-o-soft.svg`, 230px, right -86px, bottom -90px, opacity 0.3). Eyebrow, title at 19px, body at 14.5px `#C6CBF0`, then the price at 20px weight 700 white, and a link underlined in `#7A85D8`.
- **Behaviour**: flip on hover, and toggle on click or tap so touch works. Rotate the inner wrapper on Y with `transform-style: preserve-3d`; give each face `backface-visibility: hidden` AND an opacity swap, since some renderers ignore backface alone and show a mirrored back.
- The hint text must not say "hover", because touch has none. Use "Hover or tap for detail" or drop it.
- Watermark placement options for the backs are in `reference-flip-cards.html`. The set that reads best is the O cropped at a corner, the infinity along an edge, and the whole mark halved on an edge. Avoid tiny repeated marks and avoid cropping the cross so hard that only its bars remain.

---

## 8. Everything else

`reference-elements.html` is the source of truth for these, with states drawn.

- **Buttons**: primary brand blue fill; secondary 1.5px brand blue outline; tertiary tint fill with navy text; text button with a 1.5px underline and an arrow; disabled `#E4E1DA` fill with `#8A90A2` label. Sizes 18/34 hero, 15/28 default, 11/20 in cards. Use the shared 10px control radius.
- **Forms**: label 13px weight 600, input 16px with a 1px `#C9C5BC` border and 14/16 padding, help text 13px muted. Invalid state is a 1.5px **navy** border with a navy semibold message, never red. Radios and checkboxes 17 to 20px, brand blue when selected.
- **Cards**: service card with a photo slot, pricing tier with a "Most families choose this" cap, testimonial on tint, team card, guide card, navy careers card.
- **Sidebars**: ruled list for service pages, tint panel for on this page plus the fee, sticky navy enquiry card, contents with a progress rule, filter panel. On mobile these become a drawer, a collapsed header, a 62px bottom bar, a reading progress strip, and a bottom sheet respectively.
- **Footer**: navy anchor. Lockup and a closing line with both actions, then three link columns (Care at home, Company, For nurses), then a legal row carrying the assessment line. Link text on navy is `#C6CBF0`, the phone number white.
- **Icons**: 24px box, 1.75px stroke, round caps, brand blue on light and white on navy, one flat colour per glyph. 20px beside body text with a 12px gap, 14px between icons in a row. Platform logos come from each platform's own brand page, recoloured flat, never redrawn.

---

## 8b. Body wallpaper

The page base is warm white `#FAF8F4`. Eight treatments are drawn in `reference-body-wallpaper.html`, all with real content on them:

A plain warm white; B one O cropped at the right edge per section; C tint blocks behind alternating sections, edge to edge; D a faint four column ruled field; E a sparse cross field; F a tint band down the left edge; G the infinity running low, cut by the section's bottom edge; H a white content band floated on warm white with a hairline.

Rules: one treatment per site, not per section. Wallpaper never crosses body copy at readable contrast, so tint fills (`m-*-tint.svg`) on warm white, or 0.16 opacity at most for the blue mark. C and F are structural rather than decorative and are the two that survive a page with many cards. A is the default and nothing breaks without a wallpaper.

---

## 8c. Mobile

Drawn at 375px in `reference-mobile.html`. Copy is identical to desktop; only layout and size change.

- **Header**: the two pills become one white pill, lockup left and a 40px round menu button right. The WhatsApp action leaves the bar.
- **Drawer**: 310px, navy, dimmed page behind, three links at 17px, the assessment fee stated, and the WhatsApp action pinned to the bottom.
- **Care at home hero**: headline 68 to 40, buttons full width and stacked, fee on its own rule, watermark kept low.
- **For Facilities hero**: statement and steps first, then the white enquiry card full width.
- **Cards**: one column. Fronts drop from 340 to 190 tall, backs grow to 230. The hint reads "Tap for detail", never hover.
- **Forms**: inputs at 16px so iOS does not zoom on focus. Buttons full width, 44px minimum.
- **Footer**: link columns collapse to three tappable rows with chevrons.
- **Sticky bar**: appears after the first screen, 62px, the assessment fee left and WhatsApp right.

---

## 9. Photography

Every photo slot in the references is labelled with its pixel size and a one line brief. Nothing in this guide depends on imagery that does not exist yet: the chosen hero carries no photograph, and the service cards work without one.

When the library arrives: warm interiors, daylight, ordinary activity rather than posed clinical scenes, and people who look like the families being served. No text over a photograph unless there is a solid panel behind it.
