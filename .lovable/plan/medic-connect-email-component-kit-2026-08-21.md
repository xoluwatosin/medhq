# Medic Connect email component kit

Adopt the uploaded kit as the single source of truth for every email the system sends. Nothing is designed at send time. An email is a masthead, some body blocks in order, and a footer, stored as data and rendered to HTML when it goes out.

## What exists today

- `send-campaign` and `_shared/branded-email.ts` render an editorial, near-monochrome layout from a `content` string plus a `design` object with colour, font and button controls.
- `CampaignEditor` writes that content and lets a coordinator pick colours and button styling.
- Five candidate and document functions call the same shared renderer.
- `EmailTemplates` is a static gallery of hardcoded HTML previews, not a builder.

None of that matches the kit, and the design controls in the editor are exactly what the kit forbids.

## 1. The catalogue

The kit lands in the codebase as data, once, shared by the app and the edge functions.

- Block catalogue from `components.json`: every block id, its group, its text slots with character limits, its image slots with pixel sizes, its links.
- Block HTML from `blocks.html`, split on the `<!-- BLOCK: id -->` markers into a lookup of id to template.
- Tokens, the fifteen recipes, and the assembly rules.
- The supplied logo lockups go to the CDN, and the functional icon set (phone, email, address, appointment, hours, included, next, supervised) is drawn to the kit geometry and shipped as PNGs at twice display size, brand blue on light and white on navy. Platform marks use the official monochrome versions, recoloured flat. `ASSET_BASE` resolves to those CDN URLs.

## 2. The renderer

One render function, used by the builder preview and by every send.

Given a template and a data payload it assembles the named blocks in order, fills their slots, escapes copy, applies the outer wrapper, subject and preheader, and returns HTML plus a plain text alternative in which the fee reads "35,000 naira".

It refuses to render anything that breaks the rules: one masthead first, one footer last, marketing uses `ft-marketing` with the unsubscribe link and transactional uses `ft-transactional` without one, one primary button maximum, campaign and utility blocks never in the same send, red only on prices, two body photos maximum, alt text on every image, subject at most 55 characters, preheader 40 to 90 and not a repeat of the subject.

Mobile stacking, images-off behaviour and the forced dark mode surfaces come from the kit HTML and stay in it.

## 3. The builder

`/admin/email-templates` becomes the three column builder that replaces both the static gallery and the styling half of the campaign editor.

- **Palette**, left: the six groups, collapsible, searchable, with the fifteen recipes at the top as one click starts.
- **Canvas**, middle: the email at real 600px rendering, blocks dragged to reorder, hover to duplicate or delete, selected block outlined in brand blue, rule violations listed under the canvas rather than in a modal.
- **Inspector**, right: only the selected block's slots. Character counters against the limit, image fields showing the required pixel size and refusing a mismatch, link fields defaulting to the WhatsApp number and the website.
- Above the canvas: subject, preheader, marketing or transactional toggle, desktop or mobile width switch. Below: send a test, save as template.

No colour picker, no font picker, no size control, no styled rich text. Copy formatting is bold, italic and links.

Images can be uploaded to a public email assets bucket or pasted as an absolute https URL, and alt text is required either way.

## 4. Campaigns move onto the kit

The campaign editor's content field and design panel are replaced by the block canvas. Audience selection, scheduling, approval, UTM tagging and the send statistics are untouched.

Existing campaigns are converted: their current content becomes a masthead, text blocks and the correct footer, so nothing in the archive is lost and every future send is a kit send. The editorial renderer is retired once that conversion has run.

## 5. Transactional sends move too

The five functions on the shared renderer are re-pointed at recipes:

| Send | Recipe |
|---|---|
| Candidate invite, application received | `mh-transactional`, body, `utl-steps`, `ft-transactional` |
| Document request and chase | `mh-transactional`, `sm-notice-chase`, `sm-checklist`, `ft-transactional` |
| Offer notification | `mh-transactional`, `utl-table`, `btn-primary`, `ft-transactional` |
| Contract issued and signed | `mh-transactional`, body, `utl-table`, `ft-transactional` |
| Form and enquiry acknowledgement | `mh-transactional`, greeting, `utl-steps`, `btn-whatsapp`, `ft-transactional` |

The contract PDF itself keeps its own letterhead stylesheet. Only the covering email changes.

## Technical outline

- `src/lib/email-kit/` holds `catalogue.ts` (typed `components.json`), `blocks.ts` (id to HTML), `recipes.ts`, `tokens.ts`, `render.ts` and `validate.ts`. A mirrored copy under `supabase/functions/_shared/email-kit/` keeps the edge runtime self-contained, generated from the same source so the two cannot drift.
- New `email_templates` table: id, name, kind, subject, preheader, `blocks` jsonb as an ordered list of block instances, created_by, updated_at. Public schema, GRANTs to `authenticated` and `service_role`, RLS admin-only through the existing admin check. Rendered HTML is never the source of truth.
- `campaigns` gains a `blocks` jsonb column; `content` and `template_data.design` are read only for the conversion and then left behind.
- New `email-assets` storage bucket, public read, admin write, for block imagery.
- Validation runs on save, not on send, and refuses with the rule that failed in plain words.
- `EmailTemplates.tsx` is rewritten as the builder; `CampaignEditor.tsx` swaps its content and design panes for the same canvas and inspector components so there is one editor, used twice.

## Sequence

1. Catalogue, tokens, block HTML, assets on the CDN, renderer and validator, with a preview harness.
2. Builder: palette, canvas, inspector, recipes, test send, save.
3. Campaigns onto blocks, existing campaigns converted, editorial renderer retired.
4. Transactional functions onto recipes, plain text alternatives, images-off and dark mode check across the main clients.
