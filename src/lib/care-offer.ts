// A care offer: what a family is offered, priced, with the terms they accept.
//
// The content is written once when staff build the offer and fixed when it is
// sent. Totals are never stored; they are worked out here from the monthly
// fee, the length and the upfront discount, so the page, the PDF and the
// admin preview always agree.
import type { TermsClause } from "@/content/care/newborn-terms";

export interface OfferOption {
  id: string;
  title: string;
  /** Who is in the home, in a sentence. */
  staffing: string;
  monthly: number;
  summary: string;
  goodFor: string[];
  consider: string[];
  /** The rota and rest cover, for the care schedule. */
  rota?: string[];
}

export interface OfferPayment {
  bankName: string;
  accountName: string;
  accountNumber: string;
  /** Online payment link, when an invoice has been issued. */
  payOnlineUrl?: string;
}

export interface OfferContent {
  preparedFor: string;
  careFor: string;
  serviceTitle: string;
  intro: string;
  location: string;
  start: string;
  months: number;
  options: OfferOption[];
  upfrontDiscountPercent: number;
  included: string[];
  notIncluded: string[];
  howItWorks: string[];
  familyProvides: string[];
  /** Who supplies what for the baby, for the care schedule. */
  supplies?: string[];
  assessment: string;
  payment: OfferPayment;
}

export interface OfferView {
  reference: string;
  status: "draft" | "sent" | "accepted" | "withdrawn";
  content: OfferContent;
  terms_version: string;
  terms: TermsClause[];
  expires_at: string | null;
  accepted_option: string | null;
  accepted_payment: "monthly" | "upfront" | null;
  accepted_name: string | null;
  accepted_at: string | null;
  /** Paystack payment link for the first payment, made when the offer is accepted. */
  pay_url?: string | null;
  /** Whether the first payment (or the upfront one) has been received. */
  first_paid?: boolean;
  /** The family's drawn signature (a PNG data URL), once accepted. */
  accepted_signature?: string | null;
  /** Whether the signed copy of the agreement has been kept. */
  signed_copy?: boolean;
}

export type PaymentPlan = "monthly" | "upfront";

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export const optionTotals = (option: OfferOption, months: number, discountPercent: number) => {
  const total = option.monthly * months;
  // Rounded down, so the discount is never smaller than promised: to the
  // nearest ₦1,000 on larger sums, to the nearest ₦10 on small ones.
  const step = total >= 100_000 ? 1000 : 10;
  const upfront = Math.floor((total * (100 - discountPercent)) / 100 / step) * step;
  return { monthly: option.monthly, total, upfront, saving: total - upfront };
};

/** The upfront price, said plainly as a discount. */
export const upfrontLine = (t: { upfront: number; saving: number }, months: number, discountPercent: number) =>
  `Pay all ${months} months upfront: ${naira(t.upfront)}. That is a ${discountPercent}% discount, saving you ${naira(t.saving)}.`;

/** One row of a fees table. */
export interface FeeRow { label: string; value: string; strong?: boolean }

/** An option's fees, as a table, for the page and the PDF alike. */
export const feeRows = (option: OfferOption, months: number, discountPercent: number): FeeRow[] => {
  const t = optionTotals(option, months, discountPercent);
  return [
    { label: "A month", value: naira(t.monthly), strong: true },
    { label: `${months} months, paid monthly`, value: naira(t.total) },
    ...(discountPercent > 0
      ? [
          { label: `${months} months, paid upfront (${discountPercent}% discount)`, value: naira(t.upfront) },
          { label: "You save by paying upfront", value: naira(t.saving) },
        ]
      : []),
  ];
};

/** What the family pays, once they have chosen an option and how to pay. */
export const chosenFeeRows = (option: OfferOption, months: number, discountPercent: number, plan: PaymentPlan): FeeRow[] => {
  const t = optionTotals(option, months, discountPercent);
  if (plan === "upfront") {
    return [
      { label: `Your payment, for all ${months} months`, value: naira(t.upfront), strong: true },
      { label: "Full price, paid monthly", value: naira(t.total) },
      { label: `You save (${discountPercent}% discount)`, value: naira(t.saving) },
    ];
  }
  return [
    { label: "Your first payment, before care starts", value: naira(t.monthly), strong: true },
    ...(months > 1 ? [{ label: `Then each month, for ${months - 1} more months`, value: naira(t.monthly) }] : []),
    { label: `Total over ${months} months`, value: naira(t.total) },
  ];
};

/** The care schedule's rows, in words, for the page and the PDF alike. */
export interface ScheduleRow {
  label: string;
  lines: string[];
  /** Agreed with the family in the care plan before care starts, not now. */
  later?: boolean;
}

/**
 * The care schedule. What the family agrees to by accepting is kept apart
 * from what is only proposed and agreed with them in the care plan before
 * care starts, so accepting never commits them to details not yet discussed.
 */
export const scheduleRows = (
  content: OfferContent, reference: string, option: OfferOption | null, plan: PaymentPlan | null,
): ScheduleRow[] => {
  const months = content.months;
  const pct = content.upfrontDiscountPercent;
  const fees = (o: OfferOption): string[] => {
    const t = optionTotals(o, months, pct);
    const monthly = `${naira(t.monthly)} a month, paid in advance, with the first month paid before care starts. ${naira(t.total)} over ${months} months.`;
    const upfront = `${naira(t.upfront)} once, for all ${months} months. A ${pct}% discount, saving ${naira(t.saving)}.`;
    if (plan === "monthly" || pct <= 0) return [monthly];
    if (plan === "upfront") return [upfront];
    return [`Monthly: ${monthly}`, `Upfront: ${upfront}`];
  };
  const options = option ? [option] : content.options;
  const now: ScheduleRow[] = [
    { label: "Reference", lines: [`${reference}. This care schedule forms part of your agreement with the terms of care.`] },
    { label: "Care for", lines: [content.careFor] },
    { label: "Arranged by", lines: [`${content.preparedFor}, the parent or guardian making care decisions and responsible for payment, unless agreed otherwise in writing.`] },
    { label: "Where", lines: [content.location] },
    { label: "Starts", lines: [`${content.start}, after a meeting and introduction with your nurse.`] },
    { label: "Length", lines: [`${months} months from the day care starts, unless extended in writing.`] },
    ...options.map((o) => ({ label: option ? "Care" : `Care: ${o.title}`, lines: [`${o.title}. ${o.staffing}`] })),
    { label: "Responsibilities", lines: [`As listed under Your nurse's responsibilities. Not included: ${content.notIncluded.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}.`] },
    { label: "Days off and relief", lines: ["Live-in nurses have regular days off. A relief nurse we provide covers them, at no extra cost."] },
    ...options.map((o) => ({ label: option ? "Fees" : `Fees: ${o.title}`, lines: fees(o) })),
    { label: "Your home provides", lines: content.familyProvides },
    { label: "Daily updates", lines: [`A daily record of feeds, sleep and nappies, shared with ${content.preparedFor} each day. A weekly review by our clinical lead.`] },
    { label: "Contacts", lines: ["Our team: +234 812 698 8237 and hello@medicconnect.co, every day from 7am to 10pm."] },
  ];
  const later: ScheduleRow[] = [
    { label: "Start date", lines: ["The exact day care starts, once you know when the baby will be home."] },
    ...options.map((o) => ({ label: option ? "Daily routine" : `Daily routine: ${o.title}`, lines: ["Proposed, to agree with you:", ...(o.rota?.length ? o.rota : [o.summary])], later: true })),
    { label: "Days off", lines: ["Which days, for example one day a week or two days together every two weeks, to suit your family and the nurse."] },
    { label: "Supplies", lines: content.supplies?.length ? content.supplies : ["Who provides the baby's formula, bottles, nappies, wipes and toiletries, and any equipment. Nothing is bought or charged without your agreement."] },
    { label: "Baby's needs", lines: [content.assessment || "Your nurse and our clinical lead go through the baby's needs with you at the introduction.", "Feeding, sleep and any medical instructions from the hospital."] },
    { label: "Emergency plan", lines: ["Who to call, the hospital to use and how to get there, at any time of day or night."] },
    { label: "Updates", lines: ["How you would like your daily updates, for example by WhatsApp, and who else should receive them."] },
  ].map((r) => ({ ...r, later: true }));
  return [...now, ...later];
};

/** The first payment due for the plan chosen. */
export const firstPayment = (option: OfferOption, months: number, discountPercent: number, plan: PaymentPlan) => {
  const t = optionTotals(option, months, discountPercent);
  return plan === "upfront" ? t.upfront : t.monthly;
};

export const offerOpen = (offer: Pick<OfferView, "status" | "expires_at">, now = new Date()) =>
  offer.status === "sent" && (!offer.expires_at || new Date(offer.expires_at) > now);

/** Live-in newborn care, offered with one nurse or two. Staff check every line before sending. */
export const newbornLiveInTemplate = (args: {
  preparedFor: string;
  careFor: string;
  location: string;
  start: string;
  months: number;
}): OfferContent => ({
  preparedFor: args.preparedFor,
  careFor: args.careFor,
  serviceTitle: "Live-in newborn care",
  intro: `Thank you for asking us to care for ${args.careFor}. Here are two ways we can do it. Both use registered nurses or midwives with newborn experience, checked and supervised by our clinical lead. Choose the one that suits your family, then accept below.`,
  location: args.location,
  start: args.start,
  months: args.months,
  upfrontDiscountPercent: 5,
  options: [
    {
      id: "one_nurse",
      title: "One live-in nurse",
      staffing: "One nurse or midwife lives in, with a relief nurse on her days off.",
      monthly: 769000,
      summary: "Your nurse looks after the baby through the day and does the night feeds, with 8 hours of protected sleep each night.",
      goodFor: [
        "One familiar person caring for the baby every day",
        "Families who can cover some of the night, while the nurse sleeps",
        "The lower monthly cost",
      ],
      rota: [
        "Your nurse is on duty through the day, about 7am to 7pm, and does the night feeds.",
        "She has 8 hours of protected sleep each night, for example 10pm to 6am, when a parent or another adult looks after the baby.",
        "Daily breaks and handovers are agreed with you at the introduction.",
      ],
      consider: [
        "She is not awake all night. During her 8 hours of rest, a parent or another adult looks after the baby.",
        "Her days off are arranged around your family and the nurse, for example one day a week or two days together every two weeks. A relief nurse we provide covers them.",
      ],
    },
    {
      id: "live_in_and_night",
      title: "Live-in nurse + night nurse",
      staffing: "A live-in nurse or midwife for the day, and a second nurse who comes in every night from 7pm to 7am.",
      monthly: 1454000,
      summary: "There is always a nurse awake and on duty with the baby, day and night, and your day nurse is fresh each morning.",
      goodFor: [
        "Parents who need full nights of sleep",
        "Round-the-clock cover from the first night home",
        "A baby who needs closer watching at night",
      ],
      rota: [
        "Your live-in nurse is on duty from 7am to 7pm.",
        "Your night nurse is awake and on duty from 7pm to 7am, and travels in each evening.",
        "They hand over at 7am and 7pm, with a written note of feeds, sleep and anything to watch.",
      ],
      consider: [
        "Your home provides a room for the live-in nurse. The night nurse travels in each evening.",
        "Each nurse's days off are arranged around your family and the nurses. A relief nurse we provide covers those shifts.",
        "The higher monthly cost.",
      ],
    },
  ],
  included: [
    "Feeding: preparing formula, sterilising bottles, feeding and winding, and supporting breastfeeding if needed",
    "Nappies, bathing, cord care and skin care",
    "Settling and safe sleep",
    "Night feeds",
    "Going with you to check-ups and vaccinations",
    "The baby's laundry and light cleaning",
    "A daily record of feeds, sleep and nappies, shared with you each day",
    "A weekly review by our clinical lead",
    "A replacement nurse within 72 hours if the match does not work",
  ],
  notIncluded: [
    "Cooking for the household",
    "General housework",
    "Caring for other children",
    "Clinical care for the mother",
  ],
  howItWorks: [
    "Before the first shift, we arrange a meeting and introduction with your nurse.",
    "Live-in nurses have protected rest and regular days off, arranged around your family and the nurse: one day a week, or two days together every two weeks. Relief cover is included in the price.",
    "Our team is available every day from 7am to 10pm. Your care schedule includes an emergency plan for any time of night.",
    "Care fees are paid monthly in advance, with the first month paid before care starts. Or pay for all months upfront and save.",
  ],
  familyProvides: [
    "A private room for each live-in nurse to sleep and keep their things",
    "Meals and drinking water",
    "Bathroom access",
  ],
  supplies: [
    "Who provides the baby's formula, bottles, nappies, wipes and toiletries, and any equipment.",
    "Nothing is bought or charged without your agreement.",
  ],
  assessment: "No care needs assessment is needed for this care. Your nurse and our clinical lead will go through the baby's needs with you at the introduction.",
  payment: { bankName: "", accountName: "Medic Connect Limited", accountNumber: "" },
});

/** What still has to be filled in before an offer can be sent. */
export const offerGaps = (content: OfferContent): string[] => {
  const gaps: string[] = [];
  if (!content.payment.bankName.trim()) gaps.push("Bank name");
  if (!content.payment.accountName.trim()) gaps.push("Account name");
  if (!/^\d{10}$/.test(content.payment.accountNumber.trim())) gaps.push("A 10-digit account number");
  if (content.options.length === 0) gaps.push("At least one option");
  if (content.options.some((o) => !(o.monthly > 0))) gaps.push("A monthly fee for every option");
  if (!(content.months > 0)) gaps.push("How many months");
  return gaps;
};
