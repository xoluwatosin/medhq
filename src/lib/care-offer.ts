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
}

export type PaymentPlan = "monthly" | "upfront";

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export const optionTotals = (option: OfferOption, months: number, discountPercent: number) => {
  const total = option.monthly * months;
  const upfront = Math.round((total * (100 - discountPercent)) / 100 / 1000) * 1000;
  return { monthly: option.monthly, total, upfront, saving: total - upfront };
};

/** The upfront price, said plainly as a discount. */
export const upfrontLine = (t: { upfront: number; saving: number }, months: number, discountPercent: number) =>
  `Pay all ${months} months upfront: ${naira(t.upfront)}. That is a ${discountPercent}% discount, saving you ${naira(t.saving)}.`;

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
