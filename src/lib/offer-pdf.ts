// The care offer as a real PDF: text, not a picture of the page.
//
// It carries the brand as the page does: the logo on the cover and on a slim
// strip atop every later page, and the soft brand marks as watermarks. Fees
// are always shown as tables.
//
// Built straight from the offer's content with the site's own font, laid out
// for A4 with proper page breaks, so it is sharp, small and the same on every
// phone and computer. The family's download and the copy attached to the
// email both come from here.
import { GState, jsPDF } from "jspdf";
import {
  chosenFeeRows, feeRows, naira, optionTotals, scheduleRows,
  type FeeRow, type OfferContent, type OfferOption, type OfferView, type PaymentPlan,
} from "@/lib/care-offer";
import { formatDate } from "@/lib/format";

type Weight = "Regular" | "Bold" | "ExtraBold";
export type FontLoader = (weight: Weight) => Promise<string>;
/** The brand pictures, as base64 PNG: the white logo, the soft full mark and the soft O. */
export type PdfImage = "logo-white" | "mark" | "o";
export type ImageLoader = (name: PdfImage) => Promise<string>;

const C = {
  navy: [38, 48, 107] as const,
  brand: [59, 77, 196] as const,
  tint: [238, 241, 255] as const,
  ink: [26, 31, 46] as const,
  body: [74, 80, 96] as const,
  label: [99, 104, 122] as const,
  line: [220, 216, 207] as const,
  white: [255, 255, 255] as const,
};

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** In the browser, the site's own font files. */
export const browserFonts: FontLoader = async (weight) => {
  const res = await fetch(`/fonts/Figtree-${weight}.ttf`);
  if (!res.ok) throw new Error(`Font ${weight} could not be loaded`);
  return toBase64(await res.arrayBuffer());
};

/** In the browser, the brand pictures made for the PDF. */
export const browserImages: ImageLoader = async (name) => {
  const res = await fetch(`/pdf/${name}.png`);
  if (!res.ok) throw new Error(`Picture ${name} could not be loaded`);
  return toBase64(await res.arrayBuffer());
};

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // side margin
const TOP = 20;
const BOTTOM = 20;
const W = PAGE_W - M * 2;
const PT = 0.3528; // mm per point

export async function buildOfferPdf(
  offer: OfferView, loadFont: FontLoader = browserFonts, loadImage: ImageLoader = browserImages,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const [logoWhite, mark, ring] = await Promise.all((["logo-white", "mark", "o"] as PdfImage[]).map(loadImage));
  const LOGO_RATIO = 301 / 1080;
  for (const w of ["Regular", "Bold", "ExtraBold"] as Weight[]) {
    doc.addFileToVFS(`Figtree-${w}.ttf`, await loadFont(w));
    doc.addFont(`Figtree-${w}.ttf`, "Figtree", w === "Regular" ? "normal" : w === "Bold" ? "bold" : "extrabold");
  }

  const c: OfferContent = offer.content;
  let y = TOP;

  let ink: readonly number[] = C.ink;
  let fontSize = 10;
  let fontWeight: "normal" | "bold" | "extrabold" = "normal";
  const font = (weight: "normal" | "bold" | "extrabold", size: number, colour: readonly number[] = C.ink) => {
    fontWeight = weight;
    doc.setFont("Figtree", weight);
    doc.setFontSize(size);
    doc.setTextColor(colour[0], colour[1], colour[2]);
    ink = colour;
    fontSize = size;
  };

  // Figtree has no naira sign. Text is wrapped with a stand-in of similar
  // width, and the sign is drawn as an N with two strokes at the same size.
  const MARK = "\u00A4";
  const prep = (t: string) => t.replace(/₦/g, MARK);
  const write = (text: string | string[], x: number, yy: number, opts?: { align?: "right" | "center" }) => {
    const lines = Array.isArray(text) ? text : [text];
    const lh = lineH(fontSize, 1.25);
    lines.forEach((raw, li) => {
      const line = prep(raw);
      const ly = yy + li * lh;
      if (!line.includes(MARK)) { doc.text(line, x, ly, opts); return; }
      const total = line.split(MARK).reduce((w, part, i) => w + doc.getTextWidth(part) + (i > 0 ? doc.getTextWidth("N") : 0), 0);
      let cx = opts?.align === "right" ? x - total : opts?.align === "center" ? x - total / 2 : x;
      line.split(MARK).forEach((part, i) => {
        if (i > 0) {
          const wN = doc.getTextWidth("N");
          doc.text("N", cx, ly);
          const cap = fontSize * PT * 0.7;
          doc.setDrawColor(ink[0], ink[1], ink[2]);
          doc.setLineWidth(Math.max(0.12, fontSize * PT * 0.075));
          doc.line(cx - wN * 0.12, ly - cap * 0.38, cx + wN * 1.12, ly - cap * 0.38);
          doc.line(cx - wN * 0.12, ly - cap * 0.62, cx + wN * 1.12, ly - cap * 0.62);
          cx += wN;
        }
        if (part) { doc.text(part, cx, ly); cx += doc.getTextWidth(part); }
      });
    });
  };
  const lineH = (size: number, lead = 1.4) => size * PT * lead;
  const faded = (opacity: number, draw: () => void) => {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity }));
    draw();
    doc.restoreGraphicsState();
  };
  /** The soft brand mark, whole, low on the page behind the text. */
  const watermark = () => faded(0.05, () => doc.addImage(mark, "PNG", PAGE_W - M - 62, PAGE_H - 100, 74, 74, "mark", "FAST"));
  /** Later pages: a slim navy strip with the logo and the reference. */
  const strip = () => {
    fill(C.navy);
    doc.rect(0, 0, PAGE_W, 11, "F");
    doc.addImage(logoWhite, "PNG", M, 3, 22, 22 * LOGO_RATIO, "logo-white", "FAST");
    font("bold", 7.5, C.white);
    doc.text(`Care offer ${offer.reference}`, PAGE_W - M, 6.8, { align: "right" });
  };
  // The strip sets its own white text; the text that runs on from the page
  // before carries on in its own font and colour, not the strip's.
  const newPage = () => {
    const keep = { weight: fontWeight, size: fontSize, colour: ink };
    doc.addPage();
    watermark();
    strip();
    font(keep.weight, keep.size, keep.colour);
    y = TOP;
  };
  const ensure = (h: number) => { if (y + h > PAGE_H - BOTTOM) newPage(); };
  const fill = (colour: readonly number[]) => doc.setFillColor(colour[0], colour[1], colour[2]);
  const stroke = (colour: readonly number[], width = 0.3) => { doc.setDrawColor(colour[0], colour[1], colour[2]); doc.setLineWidth(width); };

  /** Wrapped text at x, width w. Moves y on, breaking pages between lines. */
  const para = (text: string, opts: { size?: number; weight?: "normal" | "bold" | "extrabold"; colour?: readonly number[]; x?: number; w?: number; lead?: number; after?: number } = {}) => {
    const size = opts.size ?? 10;
    font(opts.weight ?? "normal", size, opts.colour ?? C.body);
    const lines = doc.splitTextToSize(prep(text), opts.w ?? W) as string[];
    const lh = lineH(size, opts.lead);
    for (const l of lines) {
      ensure(lh);
      write(l, opts.x ?? M, y + size * PT * 0.8);
      y += lh;
    }
    y += opts.after ?? 0;
  };

  const measure = (text: string, size: number, w: number, weight: "normal" | "bold" | "extrabold" = "normal", lead = 1.4) => {
    font(weight, size);
    return (doc.splitTextToSize(prep(text), w) as string[]).length * lineH(size, lead);
  };

  const eyebrow = (text: string) => {
    ensure(8);
    font("extrabold", 7.5, C.brand);
    doc.text(text.toUpperCase(), M, y + 2.5, { charSpace: 0.6 });
    y += 5;
  };

  /** A part of the offer: a heavy rule, a label and a heading, kept with what follows. */
  const part = (label: string, title: string, keep = 30) => {
    y += 6;
    ensure(22 + keep);
    fill(C.navy);
    doc.rect(M, y, W, 1.2, "F");
    y += 5;
    eyebrow(label);
    para(title, { size: 16, weight: "extrabold", colour: C.navy, lead: 1.2, after: 3 });
  };

  /** A list with a filled square tick, or a dash for what is not included. */
  const bullets = (items: string[], tone: "yes" | "no" = "yes", x = M, w = W) => {
    for (const item of items) {
      const h = measure(item, 10, w - 7);
      ensure(h + 1.5);
      if (tone === "yes") {
        fill(C.brand);
        doc.rect(x, y + 0.9, 3.4, 3.4, "F");
        stroke(C.white, 0.45);
        doc.lines([[0.8, 0.8], [1.5, -1.6]], x + 0.8, y + 2.6);
      } else {
        stroke(C.label, 0.4);
        doc.line(x + 0.6, y + 2.3, x + 2.8, y + 2.3);
      }
      para(item, { size: 10, colour: C.ink, x: x + 7, w: w - 7, after: 1.5 });
    }
  };

  /** Fees as a two-column table; the first, strong row on a tint. */
  const feeTable = (rows: FeeRow[], x = M, w = W) => {
    const valueW = 42;
    const heights = rows.map((r) => Math.max(8.5, measure(r.label, r.strong ? 10 : 9, w - valueW - 6, r.strong ? "extrabold" : "bold", 1.25) + 4.5));
    const total = heights.reduce((a, b) => a + b, 0);
    ensure(total);
    const top = y;
    rows.forEach((r, i) => {
      const h = heights[i];
      if (r.strong) { fill(C.tint); doc.rect(x, y, w, h, "F"); }
      if (i > 0) { stroke(C.line, 0.3); doc.line(x, y, x + w, y); }
      font(r.strong ? "extrabold" : "bold", r.strong ? 10 : 9, r.strong ? C.navy : C.label);
      const lines = doc.splitTextToSize(r.label, w - valueW - 6) as string[];
      const textTop = y + (h - lines.length * lineH(r.strong ? 10 : 9, 1.25)) / 2 + (r.strong ? 10 : 9) * PT * 0.8;
      doc.text(lines, x + 3, textTop, { lineHeightFactor: 1.25 });
      font("extrabold", r.strong ? 13 : 10, r.strong ? C.navy : C.ink);
      write(r.value, x + w - 3, y + h / 2 + (r.strong ? 13 : 10) * PT * 0.35, { align: "right" });
      y += h;
    });
    stroke(C.navy, 0.5);
    doc.rect(x, top, w, total);
  };

  const footer = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      stroke(C.line, 0.3);
      doc.line(M, PAGE_H - 13, PAGE_W - M, PAGE_H - 13);
      font("normal", 7.5, C.label);
      doc.text("Medic Connect Limited, RC 8026476, 145 Igbosere Road, Lagos Island, Lagos", M, PAGE_H - 8.5);
      doc.text("hello@medicconnect.co   +234 812 698 8237", M, PAGE_H - 5);
      doc.text(`${offer.reference}   Page ${i} of ${total}`, PAGE_W - M, PAGE_H - 8.5, { align: "right" });
    }
  };

  /* ---- Cover band ---- */
  watermark();
  fill(C.navy);
  doc.rect(0, 0, PAGE_W, 46, "F");
  // The soft O, cropped by the band, as on the site's navy.
  doc.saveGraphicsState();
  doc.rect(0, 0, PAGE_W, 46, null);
  doc.clip();
  doc.discardPath();
  faded(0.5, () => doc.addImage(ring, "PNG", PAGE_W - 62, -38, 96, 96, "o", "FAST"));
  doc.restoreGraphicsState();
  doc.addImage(logoWhite, "PNG", M, 9, 40, 40 * LOGO_RATIO, "logo-white", "FAST");
  font("extrabold", 7.5, C.white);
  doc.text("CARE OFFER", PAGE_W - M, 15, { align: "right", charSpace: 0.6 });
  font("bold", 9, C.white);
  doc.text(offer.reference, PAGE_W - M, 20, { align: "right" });
  font("extrabold", 21, C.white);
  doc.text(`Your care offer for ${c.careFor}`, M, 34);
  font("normal", 10, C.white);
  doc.text(`Prepared for ${c.preparedFor}`, M, 41);
  y = 56;

  para(c.intro, { size: 10.5, colour: C.ink, lead: 1.5, after: 5 });

  /* ---- Summary ---- */
  const facts = [
    ["Care for", c.careFor], ["Care", `${c.serviceTitle}, ${c.months} months`],
    ["Where", c.location], ["Starts", c.start],
    ["Reference", offer.reference], ["Valid until", offer.expires_at ? formatDate(offer.expires_at) : "Ask us"],
  ];
  const colW = W / 2;
  for (let r = 0; r < 3; r++) {
    const pair = facts.slice(r * 2, r * 2 + 2);
    const h = Math.max(...pair.map(([, v]) => measure(v, 10.5, colW - 8, "bold", 1.3))) + 9;
    ensure(h);
    stroke(C.navy, 0.5);
    pair.forEach(([k, v], i) => {
      const x = M + i * colW;
      doc.rect(x, y, colW, h);
      font("bold", 8, C.label);
      doc.text(k, x + 4, y + 5);
      font("bold", 10.5, C.navy);
      doc.text(doc.splitTextToSize(v, colW - 8) as string[], x + 4, y + 10);
    });
    y += h;
  }

  /* ---- Options ---- */
  part("Your options", c.options.length > 1 ? "Compare the options" : "The care we are offering", 60);
  const optionBox = (o: OfferOption) => {
    const inner = W - 12;
    const fees = feeRows(o, c.months, c.upfrontDiscountPercent);
    const priceH = fees.length * 9 + 2;
    const listH = (items: string[]) => items.reduce((s, i) => s + measure(i, 10, inner - 7) + 1.5, 0);
    const h = 8 + measure(o.title, 14, inner, "extrabold", 1.2) + measure(o.staffing, 10, inner, "bold") + 2
      + measure(o.summary, 10, inner) + 4 + priceH + 6 + 6 + listH(o.goodFor) + 6 + listH(o.consider) + 6;
    if (h < PAGE_H - TOP - BOTTOM) ensure(h);
    const top = y;
    const startPage = doc.getNumberOfPages();
    y += 6;
    para(o.title, { size: 14, weight: "extrabold", colour: C.navy, x: M + 6, w: inner, lead: 1.2, after: 1 });
    para(o.staffing, { size: 10, weight: "bold", colour: C.ink, x: M + 6, w: inner, after: 1.5 });
    para(o.summary, { size: 10, colour: C.body, x: M + 6, w: inner, after: 3 });
    feeTable(fees, M + 6, inner);
    y += 5;
    font("extrabold", 7.5, C.label);
    ensure(6);
    doc.text("GOOD FOR", M + 6, y + 2.5, { charSpace: 0.6 });
    y += 5;
    bullets(o.goodFor, "yes", M + 6, inner);
    y += 2;
    ensure(6);
    font("extrabold", 7.5, C.label);
    doc.text("WORTH KNOWING", M + 6, y + 2.5, { charSpace: 0.6 });
    y += 5;
    bullets(o.consider, "no", M + 6, inner);
    y += 3;
    if (doc.getNumberOfPages() === startPage) {
      stroke(C.navy, 0.6);
      doc.rect(M, top, W, y - top);
    }
    y += 5;
  };
  if (c.options.length > 1) {
    const rows: [string, (o: OfferOption) => string][] = [
      ["A month", (o) => naira(o.monthly)],
      [`${c.months} months, paid monthly`, (o) => naira(optionTotals(o, c.months, c.upfrontDiscountPercent).total)],
      ...(c.upfrontDiscountPercent > 0
        ? [
            [`${c.months} months upfront (${c.upfrontDiscountPercent}% discount)`, (o: OfferOption) => naira(optionTotals(o, c.months, c.upfrontDiscountPercent).upfront)] as [string, (o: OfferOption) => string],
            ["You save upfront", (o: OfferOption) => naira(optionTotals(o, c.months, c.upfrontDiscountPercent).saving)] as [string, (o: OfferOption) => string],
          ]
        : []),
    ];
    const firstCol = 62;
    const col = (W - firstCol) / c.options.length;
    const headH = Math.max(...c.options.map((o) => measure(o.title, 9, col - 6, "extrabold", 1.25))) + 6;
    ensure(headH + rows.length * 9 + 4);
    fill(C.navy);
    doc.rect(M, y, W, headH, "F");
    font("extrabold", 9, C.white);
    c.options.forEach((o, i) => doc.text(doc.splitTextToSize(o.title, col - 6) as string[], M + firstCol + i * col + 3, y + 5));
    y += headH;
    for (const [label, value] of rows) {
      stroke(C.line, 0.3);
      doc.line(M, y, M + W, y);
      font("bold", 9, C.label);
      doc.text(doc.splitTextToSize(label, firstCol - 6) as string[], M + 3, y + 5.6);
      font("extrabold", 10, C.ink);
      c.options.forEach((o, i) => write(value(o), M + firstCol + i * col + 3, y + 5.6));
      y += 9;
    }
    stroke(C.navy, 0.6);
    doc.rect(M, y - headH - rows.length * 9, W, headH + rows.length * 9);
    y += 4;
    para("Each option in detail follows.", { size: 9.5, after: 4 });
  }
  c.options.forEach(optionBox);

  para("These are the full prices. Nothing is added for nights, public holidays, travel to and from your home, or administration. No VAT is charged.", { size: 9.5, after: 2 });

  /* ---- Responsibilities ---- */
  part("What is included", "Your nurse's responsibilities");
  bullets(c.included);
  y += 3;
  eyebrow("Not included");
  bullets(c.notIncluded, "no");

  /* ---- Care schedule ---- */
  part("Your care schedule", "Care schedule", 30);
  {
    const chosen = c.options.find((o) => o.id === offer.accepted_option) ?? null;
    const plan = offer.status === "accepted" ? (offer.accepted_payment ?? null) : null;
    const labelW = 42;
    const all = scheduleRows(c, offer.reference, chosen, plan);
    let shownLater = false;
    eyebrow("What you agree to now");
    for (const row of all) {
      if (row.later && !shownLater) {
        shownLater = true;
        stroke(C.line, 0.3);
        doc.line(M, y, M + W, y);
        y += 6;
        eyebrow("What we agree with you before care starts");
        para("These are part of your care plan. We go through them with you at the introduction, and nothing here is charged without your agreement.", { size: 9, after: 2 });
      }
      const h = row.lines.reduce((sum, l) => sum + measure(l, 9.5, W - labelW - 4) + 1, 0) + 4;
      ensure(Math.min(h, 40));
      stroke(C.line, 0.3);
      doc.line(M, y, M + W, y);
      const top = y;
      font("bold", 8.5, C.label);
      doc.text(doc.splitTextToSize(row.label, labelW - 4) as string[], M, y + 5);
      y += 2;
      row.lines.forEach((l) => para(l, { size: 9.5, colour: C.ink, x: M + labelW, w: W - labelW, after: 1 }));
      y = Math.max(y + 1.5, top + 10);
    }
    stroke(C.line, 0.3);
    doc.line(M, y, M + W, y);
  }

  /* ---- Paying ---- */
  part("Paying", "How to pay");
  para(`Pay by bank transfer, using ${offer.reference} as the payment reference. We confirm every payment in writing.`, { size: 10, after: 3 });
  const bank = [
    ["Bank", c.payment.bankName || "To follow"], ["Account number", c.payment.accountNumber || "To follow"],
    ["Account name", c.payment.accountName], ["Payment reference", offer.reference],
  ];
  ensure(26);
  stroke(C.navy, 0.5);
  for (let r = 0; r < 2; r++) {
    bank.slice(r * 2, r * 2 + 2).forEach(([k, v], i) => {
      const x = M + i * colW;
      doc.rect(x, y, colW, 13);
      font("bold", 8, C.label);
      doc.text(k, x + 4, y + 5);
      font("extrabold", 11, C.navy);
      doc.text(v, x + 4, y + 10.5);
    });
    y += 13;
  }

  /* ---- Terms ---- */
  part("The agreement", "Terms of care", 20);
  para(offer.terms_version, { size: 9, weight: "bold", colour: C.label, after: 2 });
  for (const clause of offer.terms) {
    if (clause.group) {
      y += 2;
      ensure(14);
      font("extrabold", 7.5, C.brand);
      doc.text(clause.group.toUpperCase(), M, y + 2.5, { charSpace: 0.6 });
      y += 5;
    }
    ensure(14);
    para(`${clause.number}. ${clause.title}`, { size: 11, weight: "extrabold", colour: C.navy, after: 1.5 });
    clause.paragraphs.forEach((p) => para(p, { size: 9.5, colour: C.body, after: 2 }));
    y += 1.5;
  }

  /* ---- Signed, when accepted ---- */
  if (offer.status === "accepted" && offer.accepted_name) {
    const chosen = c.options.find((o) => o.id === offer.accepted_option);
    part("Signed", "Your acceptance", 70);
    para(`I accept this offer, its fees and the terms of care above. I understand the details of my care plan, such as the daily routine, supplies and emergency plan, will be agreed with me before care starts.`, { size: 10, colour: C.ink, after: 3 });
    if (chosen) feeTable(chosenFeeRows(chosen, c.months, c.upfrontDiscountPercent, (offer.accepted_payment ?? "monthly") as PaymentPlan));
    y += 4;
    const boxH = 34;
    ensure(boxH + 22);
    const half = W / 2;
    stroke(C.navy, 0.5);
    doc.rect(M, y, W, boxH + 14);
    // The signature, as drawn, on its signing line.
    if (offer.accepted_signature) {
      try {
        const props = doc.getImageProperties(offer.accepted_signature);
        const h = boxH - 6;
        const w = Math.min(half - 8, (props.width / props.height) * h);
        doc.addImage(offer.accepted_signature, "PNG", M + 4, y + 3, w, h);
      } catch {
        // A signature that cannot be drawn leaves the typed name to stand.
      }
    }
    stroke(C.line, 0.4);
    doc.line(M + 4, y + boxH, M + half - 4, y + boxH);
    font("bold", 8, C.label);
    doc.text("Signature", M + 4, y + boxH + 5);
    font("extrabold", 10.5, C.navy);
    doc.text(offer.accepted_name, M + 4, y + boxH + 10.5);
    const rx = M + half + 4;
    const facts: [string, string][] = [
      ["Signed on", offer.accepted_at ? formatDate(offer.accepted_at) : ""],
      ["Option", chosen?.title ?? ""],
      ["Paying", offer.accepted_payment === "upfront" ? `All ${c.months} months upfront` : "Monthly"],
      ["Terms", offer.terms_version],
    ];
    facts.forEach(([k, v], i) => {
      font("bold", 8, C.label);
      doc.text(k, rx, y + 6 + i * 10);
      font("bold", 9.5, C.ink);
      doc.text(doc.splitTextToSize(v, half - 10)[0] ?? "", rx, y + 10.5 + i * 10);
    });
    y += boxH + 18;
    para(`Signed online on the Medic Connect website, with reference ${offer.reference}.`, { size: 8.5, colour: C.label });
  }

  footer();
  return doc.output("blob");
}

export const offerPdfName = (reference: string) => `Medic Connect care offer ${reference}.pdf`;

/** The PDF as base64, to email or to keep as the signed copy. */
export async function offerPdfBase64(offer: OfferView): Promise<string> {
  const blob = await buildOfferPdf(offer);
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function downloadOfferPdf(offer: OfferView) {
  const blob = await buildOfferPdf(offer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = offerPdfName(offer.reference);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
