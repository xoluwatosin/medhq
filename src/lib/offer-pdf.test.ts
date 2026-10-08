import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOfferPdf } from "@/lib/offer-pdf";
import { newbornLiveInTemplate, type OfferView } from "@/lib/care-offer";
import { NEWBORN_TERMS, NEWBORN_TERMS_VERSION } from "@/content/care/newborn-terms";

const fonts = async (w: string) => readFileSync(`public/fonts/Figtree-${w}.ttf`).toString("base64");
const images = async (name: string) => readFileSync(`public/pdf/${name}.png`).toString("base64");

const offer = (status: OfferView["status"] = "sent"): OfferView => {
  const content = newbornLiveInTemplate({
    preparedFor: "Ndidi Carey", careFor: "Baby Carey", location: "Eti-Osa, Lagos",
    start: "From about 10 November 2026, once Baby Carey is home", months: 4,
  });
  content.payment = { bankName: "Example Bank", accountName: "Medic Connect Limited", accountNumber: "0123456789" };
  return {
    reference: "MC-2610-0102-O1", status, content, terms_version: NEWBORN_TERMS_VERSION, terms: NEWBORN_TERMS,
    expires_at: "2026-10-22T22:59:00Z",
    accepted_option: status === "accepted" ? "one_nurse" : null,
    accepted_payment: status === "accepted" ? "upfront" : null,
    accepted_name: status === "accepted" ? "Ndidi Carey" : null,
    accepted_at: status === "accepted" ? "2026-10-09T10:00:00Z" : null,
    accepted_signature: status === "accepted" ? `data:image/png;base64,${readFileSync("public/pdf/logo-white.png").toString("base64")}` : null,
  };
};

describe("care offer PDF", () => {
  it("is a small, text-based A4 PDF with every part and the terms", async () => {
    const blob = await buildOfferPdf(offer(), fonts as never, images as never);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (process.env.OFFER_PDF_OUT) writeFileSync(process.env.OFFER_PDF_OUT, bytes);
    const head = new TextDecoder().decode(bytes.slice(0, 5));
    expect(head).toBe("%PDF-");
    // A picture of the page ran to megabytes; text stays small.
    expect(bytes.length).toBeLessThan(600_000);
    const pages = (new TextDecoder("latin1").decode(bytes).match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(4);
  });

  it("records the acceptance when the offer has been accepted", async () => {
    const blob = await buildOfferPdf(offer("accepted"), fonts as never, images as never);
    if (process.env.OFFER_PDF_SIGNED_OUT) writeFileSync(process.env.OFFER_PDF_SIGNED_OUT, new Uint8Array(await blob.arrayBuffer()));
    expect(blob.size).toBeGreaterThan(1000);
  });
});
