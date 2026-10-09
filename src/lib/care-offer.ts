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
  /** Which kind of care, for the wording; offers made before this was kept are newborn care. */
  kind?: "newborn" | "eldercare";
  /** What the family calls the person giving care, e.g. nurse or caregiver. */
  carer?: string;
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
  /** Who supplies what for the person receiving care, for the care schedule. */
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

/** The words that change with the kind of care, so one offer page serves every service. */
export const offerWords = (content: Pick<OfferContent, "kind" | "carer" | "careFor">) => {
  const elder = content.kind === "eldercare";
  const carer = content.carer || (elder ? "caregiver" : "nurse");
  return {
    carer,
    /** "Your nurse's responsibilities", "Your caregiver's responsibilities". */
    duties: `Your ${carer}'s responsibilities`,
    arrangedBy: elder
      ? "the family member arranging care and responsible for payment. Care decisions are made with the person receiving care, or with someone with lawful authority to decide for them."
      : "the parent or guardian making care decisions and responsible for payment, unless agreed otherwise in writing.",
    startDate: elder
      ? "The exact day, after the home assessment and the introduction."
      : "The exact day, once you know when the baby will be home.",
    supplies: elder
      ? "Who provides continence products, toiletries, mobility aids and any equipment, such as a commode or shower chair. Nothing is bought or charged without your agreement."
      : "Who provides the baby's formula, bottles, nappies, wipes and toiletries, and any equipment. Nothing is bought or charged without your agreement.",
    needsLabel: elder ? "Care needs" : "Baby's needs",
    needsDetail: elder
      ? "Medicines, diet, mobility, memory and any instructions from their doctor."
      : "Feeding, sleep and any medical instructions from the hospital.",
    needsFallback: elder
      ? `Your ${carer} and our clinical lead go through ${content.careFor}'s needs with you before care starts.`
      : "Your nurse and our clinical lead go through the baby's needs with you at the introduction.",
  };
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
    const monthly = `${naira(t.monthly)} a month, paid in advance; the first month before care starts.`;
    const upfront = `${naira(t.upfront)} once, for all ${months} months (${pct}% discount).`;
    if (plan === "monthly" || pct <= 0) return [monthly];
    if (plan === "upfront") return [upfront];
    return [`Monthly: ${monthly}`, `Upfront: ${upfront}`];
  };
  const options = option ? [option] : content.options;
  const w = offerWords(content);
  // A short record: each fact once. What the rest of the offer already sets
  // out (the duties, the option in full) is referred to, not retold.
  const now: ScheduleRow[] = [
    { label: "Reference", lines: [`${reference}, part of your agreement with the terms of care.`] },
    { label: "Arranged by", lines: [`${content.preparedFor}, ${w.arrangedBy}`] },
    { label: "Care for", lines: [`${content.careFor}, at home in ${content.location}.`] },
    ...options.map((o) => ({ label: option ? "Care" : `Care: ${o.title}`, lines: [o.staffing] })),
    { label: "Starts", lines: [`${content.start}, for ${months} months, after a meeting and introduction with your ${w.carer}. Longer only if agreed in writing.`] },
    { label: "Duties", lines: [`As set out in ${w.duties}.`] },
    ...options.map((o) => ({ label: option ? "Fees" : `Fees: ${o.title}`, lines: fees(o) })),
    { label: "Your home provides", lines: content.familyProvides },
    { label: "Contacts", lines: ["+234 812 698 8237 and hello@medicconnect.co, every day from 7am to 10pm."] },
  ];
  const later: ScheduleRow[] = [
    { label: "Start date", lines: [w.startDate] },
    ...options.map((o) => ({ label: option ? "Daily routine" : `Daily routine: ${o.title}`, lines: ["Proposed, to agree with you:", ...(o.rota?.length ? o.rota : [o.summary])], later: true })),
    { label: "Days off", lines: [`Which days, for example one day a week or two days together every two weeks. A relief ${w.carer} we provide covers them, at no extra cost.`] },
    { label: "Supplies", lines: content.supplies?.length ? content.supplies : [w.supplies] },
    { label: w.needsLabel, lines: [content.assessment || w.needsFallback, w.needsDetail] },
    { label: "Emergency plan", lines: ["Who to call, the hospital to use and how to get there, at any time of day or night."] },
    { label: "Updates", lines: ["How you would like your daily record and updates, for example by WhatsApp, and who else should receive them."] },
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
  kind: "newborn",
  carer: "nurse",
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
  payment: { bankName: "Providus Bank", accountName: "Medic Connect Limited", accountNumber: "1307500114" },
});

/** Published eldercare fees, from the site's fee list (PUB-COMPANION-4H, PUB-LIVE-IN, PUB-ASSESSMENT). */
export const ELDERCARE_FEES = { companionVisit: 18000, visitsPerMonth: 13, liveIn: 300000, assessment: 35000 } as const;

/**
 * Eldercare and companion care, offered as morning visits or a live-in
 * caregiver, at the published prices. A home assessment comes first, as the
 * eldercare page promises. Staff check every line before sending.
 */
export const eldercareTemplate = (args: {
  preparedFor: string;
  careFor: string;
  location: string;
  start: string;
  months: number;
}): OfferContent => {
  const visits = ELDERCARE_FEES.companionVisit * ELDERCARE_FEES.visitsPerMonth;
  return {
    kind: "eldercare",
    carer: "caregiver",
    preparedFor: args.preparedFor,
    careFor: args.careFor,
    serviceTitle: "Eldercare and companion care",
    intro: `Thank you for asking us to care for ${args.careFor}. Here are two ways we can help, at home. Both use trained caregivers, checked by us and supervised by our clinical lead, and both start with a home assessment so the care fits ${args.careFor}'s needs. Choose the one that suits your family, then accept below.`,
    location: args.location,
    start: args.start,
    months: args.months,
    upfrontDiscountPercent: 5,
    options: [
      {
        id: "morning_visits",
        title: "Companion visits, three mornings a week",
        staffing: "A trained caregiver visits for 4 hours, three mornings a week.",
        monthly: visits,
        summary: `Your caregiver helps ${args.careFor} start the day well: washing and dressing, breakfast, medicines on time, a walk or exercises, and good company. You get a note on WhatsApp after every visit.`,
        goodFor: [
          "Someone who is mostly independent but needs help in the mornings",
          "Family nearby who cover evenings and nights",
          "The lower monthly cost",
        ],
        rota: [
          "Three mornings a week, for example Monday, Wednesday and Friday, 8am to 12 noon.",
          "Each visit: a check-in, washing and dressing, breakfast to their diet, morning medicines as prescribed, a walk or exercises, then a note to you on WhatsApp.",
          "The days and times are agreed with you at the introduction.",
        ],
        consider: [
          `Between visits, ${args.careFor} is on their own or with family.`,
          `Charged at a fixed monthly fee: 13 visits of 4 hours at ₦18,000 each, the average month. A visit we cancel is refunded.`,
        ],
      },
      {
        id: "live_in",
        title: "One live-in caregiver",
        staffing: "A trained caregiver lives in, with a relief caregiver on their days off.",
        monthly: ELDERCARE_FEES.liveIn,
        summary: `Your caregiver is there through the day and helps at night if needed, with 8 hours of protected rest each night, so ${args.careFor} is never left alone for long.`,
        goodFor: [
          "Someone who needs help through the day, every day",
          "Reassurance that someone is always at home",
          "Families who live far away or abroad",
        ],
        rota: [
          "Your caregiver is on duty through the day, about 7am to 7pm, and helps at night if needed.",
          "They have 8 hours of protected rest each night, for example 10pm to 6am. If help is needed most nights, we review the rota with you.",
          "Daily breaks and handovers are agreed with you at the introduction.",
        ],
        consider: [
          "Your caregiver is not awake all night. If someone awake at night is needed, we add a night caregiver at a price agreed with you first.",
          "Your home provides a private room for the caregiver. Their days off are arranged around your family and the caregiver, and a relief caregiver we provide covers them.",
        ],
      },
    ],
    included: [
      "Personal care: washing, bathing, dressing, grooming and help with the toilet and continence",
      "Meals and drinks prepared to their diet, and help with eating if needed",
      "Medicine reminders and help taking prescribed medicines, as set out in the care plan",
      "Help moving around safely, gentle exercise and fall prevention",
      "Companionship: conversation, walks, hobbies and keeping in touch with family",
      "Their laundry and keeping their room tidy",
      "Going with them to appointments within care hours, by agreement",
      "A note to you on WhatsApp after every visit, or each day for live-in care",
      "A care plan reviewed by our clinical lead every month, sooner if needs change",
      "A replacement caregiver if the usual one is unwell, and a new match within 72 hours if it is not the right fit",
    ],
    notIncluded: [
      "Clinical nursing tasks, such as injections, wound care or catheter care (we can add a nurse, priced separately)",
      "Cooking and cleaning for the household",
      "General housework",
      "Care for other members of the household",
    ],
    howItWorks: [
      "First, a home assessment by our care coordinator, reviewed by our clinical lead.",
      "Before the first visit or shift, we arrange a meeting and introduction with your caregiver.",
      "Our team is available every day from 7am to 10pm. Your care schedule includes an emergency plan for any time of night.",
      "Care fees are paid monthly in advance, with the first month paid before care starts. Or pay for all months upfront and save.",
    ],
    familyProvides: [
      "For live-in care, a private room for the caregiver to sleep and keep their things",
      "For live-in care, meals and drinking water",
      "Safe access to the home and to what is needed for care",
    ],
    supplies: [
      "Who provides continence products, toiletries, mobility aids and any equipment, such as a commode or shower chair.",
      "Nothing is bought or charged without your agreement.",
    ],
    assessment: `A one-off home assessment is needed before care starts. It costs ₦35,000, paid separately, and is carried out by our care coordinator and reviewed by our clinical lead. It shapes ${args.careFor}'s care plan. If it shows different needs, we offer you a revised care offer before anything starts.`,
    payment: { bankName: "Providus Bank", accountName: "Medic Connect Limited", accountNumber: "1307500114" },
  };
};

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
