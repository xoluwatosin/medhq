# Campaign editor rethink

## Goal
Replace the current block-list, token-editing, and separate-preview workflow with one direct email canvas. Administrators should click what they see, edit it naturally, and always have clear controls to move, duplicate, replace, or delete content.

## What is wrong today
- The campaign is assembled in a block list, edited in a separate inspector, and rendered again in a read-only iframe. Those three representations make it unclear where editing actually happens.
- A linked PDF is converted into a raw `[[cta:...]]` token inside body text and simultaneously removed from the attachment list. After that conversion, the attachment controls disappear and deletion requires manually recognising and removing token syntax.
- Dragging relies on textarea cursor state, which is imprecise and unavailable on touch devices.
- The attachment area sits below the builder, far from the content it affects, so its relationship to an inline download button is hidden.

## New editing experience

### 1. One live email canvas
- Make the rendered email the primary editing surface rather than showing a block summary above a separate preview.
- Clicking text opens natural inline editing in place.
- Clicking a button selects it and exposes its label, destination, alignment, and style in a compact contextual toolbar.
- Keep subject and preheader above the canvas because they are inbox metadata, not email-body content.

### 2. Explicit element controls
- Every selected email element gets visible move, duplicate, and delete controls.
- Reordering uses clear insertion gaps on desktop, with move up/down controls retained for keyboard and mobile use.
- Deletion uses the element model, never raw-token editing. Removing a PDF button does not delete the uploaded PDF unless the administrator explicitly chooses that action.

### 3. Asset library for PDFs
- Replace the detached “Attachments” area with a nearby Assets panel listing each uploaded PDF.
- Each PDF has editable display name, file name, size, open, replace, insert, and delete actions.
- “Insert” creates a normal button element at the currently selected insertion point. It does not remove the PDF from Assets.
- Deleting offers clear choices where needed: remove only the button, or delete the uploaded file and all references.
- Keep branded Medic Connect download URLs behind the scenes. Administrators edit human-readable labels, not URLs or token syntax.

### 4. Preview without a second mental model
- Add Edit and Preview modes to the same canvas.
- Edit mode shows selection outlines and controls; Preview mode hides all editor chrome and supports desktop/mobile widths.
- Preserve the existing sent-email renderer as the single source of truth so the preview and delivered email remain equivalent.

### 5. Responsive workflow
- Desktop: assets/content tools on the left, live email canvas in the centre, contextual properties on the right.
- Tablet/mobile: canvas first, with Blocks/Assets and Properties opening as sheets; all actions work without drag and drop.
- Keep accessible buttons for moving elements so drag is optional rather than required.

## Technical approach
- Evolve the existing `EmailTemplateDoc` block model instead of introducing a second document format.
- Represent PDF links as ordinary button blocks with an asset reference and editable presentation fields, rather than embedding CTA tokens in rich-text strings.
- Add a compatibility conversion when loading existing campaigns so current inline CTA tokens continue to render and can be promoted into editable button elements without losing copy or links.
- Refactor the shared email builder so campaign and template editors use the same direct-canvas interactions.
- Keep autosave, validation, test-send, audience selection, campaign statistics, and sent-campaign read-only behaviour unchanged.

## Validation
- Test add, edit, move, duplicate, replace, and delete for text, ordinary buttons, and PDF buttons.
- Verify legacy campaigns containing CTA tokens load without data loss.
- Confirm desktop and touch/mobile workflows do not depend on dragging.
- Compare Edit, Preview, and test-email output for visual and link parity.
- Verify file deletion cannot leave silent broken links and that removing a button alone preserves the uploaded PDF.
