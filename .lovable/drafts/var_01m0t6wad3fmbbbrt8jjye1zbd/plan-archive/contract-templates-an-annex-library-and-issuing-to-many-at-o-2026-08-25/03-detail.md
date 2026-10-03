## How a template behaves

A template holds three kinds of value, and the difference is what keeps this from getting confusing:

- **Fixed.** The same on every contract from this template: the clause wording, notice period, working pattern, the annex set. Change it in the template and the next contract picks it up. Contracts already issued never change.
- **Prefilled from the person.** Name, address, email, job title, place of work, start date, pay: the system fills these from their record and the offer they accepted. You can override any of them on their copy before issuing.
- **Ask each time.** Fields the template marks as required but cannot know, for example who they report to. A contract cannot be issued while one is empty, and the review table shows it in red.

So a role where everyone gets the same terms is a template with almost nothing to confirm, and a role where pay differs per person is the same template with pay overridden on each row.

## The annex library

Each annex is a record with a code, a title, and a kind:

- **Document.** Rich text you click and edit in the app, exactly like a clause. It prints as part of the contract in the same house style. Your HTML drafts become the starting wording for these, and job description is the obvious first one.
- **File.** A PDF or similar attached once in the library, reused by every contract that carries it, still overridable per contract.

A template names which annexes it carries, which of them the person must sign, and whether an annex is clinical only. At the moment of issue the annex wording is frozen along with the clauses, so the signed pack is reproducible.

Annexes stay editable per contract for one-offs, as they are now.

## Issuing to many

From a template you open "Issue to candidates". You get a list of people who accepted an offer for that role, or anyone else you search for. Ticking a person adds a row showing the prefilled terms, with warnings for anything missing or for a person who is not clear to be contracted, for example documents not accepted.

You can edit a term inline on a row, or open that person's full document, read it and come back. Issuing runs the same create, freeze and send that a single contract runs today, once per person, and reports what went out and what was skipped and why.

## Technical notes

- Two new tables: a contract template (fields, clauses, annex set, field rules) and an annex library entry (code, title, kind, body or file path, signature flag, clinical flag). Both additive, with grants and admin-only policies. Applied when you accept this draft.
- `mu_contracts` gains a template reference and frozen annex bodies alongside the frozen clauses. No existing column changes.
- Creation stays on the existing `mu_contract_create_from_library` path, extended to seed from a template rather than the raw clause library, so the editor, signing page, PDF and filing keep working untouched.
- Batch issue is the existing per-contract create, save, issue and email calls run over a list, with a result per person, not a new signing mechanism.
- The renderer prints document annexes after the letter, using the same stylesheet, so screen, print and PDF stay identical.

## Build order

1. Annex library, with the document editor and the file kind.
2. Contract templates, with the three field kinds and the annex set.
3. Create a single contract from a template, prefilled from person and offer.
4. Issue to many: the review table, per-row overrides, open-in-full, batch issue with a result report.
5. Load your annex HTML drafts into the library.

Send the HTML drafts whenever they are ready; step 5 is independent, so the rest can be built before they arrive.
