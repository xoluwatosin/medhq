// The one list of care kinds, shared by every door into the enquiry desk:
// the Request care journey, the welcome pop-up and the WhatsApp widget.
// Each carries the same illustration and starting price as its card on
// Care at home, so the pop-up and the site show one set of services.
import { art } from "@/components/mc/art";

export type Who = "pregnant" | "baby" | "child" | "adult" | "older";

export const WHO_LABEL: Record<Who, string> = {
  pregnant: "someone pregnant, or a new mother",
  baby: "a baby or newborn",
  child: "a child",
  adult: "an adult",
  older: "an older person",
};

export interface CareKind {
  line: string;
  label: string;
  blurb: string;
  who: Who[];
  /** The service card illustration. */
  art: string;
  /** Starting price, "₦18,000", or "" when quoted after the assessment. */
  price: string;
}

export const CARE_KINDS: CareKind[] = [
  { line: "antenatal", label: "Antenatal care at home", blurb: "Support through pregnancy", who: ["pregnant"], art: art.midwifePregnantBp, price: "₦30,000" },
  { line: "postnatal", label: "Postnatal care and Omugwo", blurb: "Mother and baby, after birth", who: ["pregnant", "baby"], art: art.proPostnatal, price: "₦20,000" },
  { line: "post_surgical", label: "Post-surgical care at home", blurb: "Recovery after an operation", who: ["child", "adult", "older"], art: art.objWalkingFrame, price: "₦20,000" },
  { line: "eldercare", label: "Eldercare and companion care", blurb: "Day-to-day help and company", who: ["older"], art: art.charGrandma, price: "₦18,000" },
  { line: "clinical_home_care", label: "Clinical home care", blurb: "Nursing and clinical procedures", who: ["pregnant", "baby", "child", "adult", "older"], art: art.proNurseKit, price: "₦18,000" },
  { line: "nanny_childcare", label: "Nanny and childcare", blurb: "Trusted care for little ones", who: ["baby", "child"], art: art.nannyReading, price: "" },
  { line: "paediatric", label: "Children with additional needs", blurb: "Specialist support for children", who: ["child"], art: art.charBoy, price: "" },
  { line: "care_from_abroad", label: "Care for family back home", blurb: "Arranging care from abroad", who: ["adult", "older", "pregnant", "baby", "child"], art: art.diasporaSon, price: "" },
  { line: "general", label: "Something else / I'm not sure", blurb: "We will help you work it out", who: ["pregnant", "baby", "child", "adult", "older"], art: art.objPhoneChat, price: "" },
];

export const kindByLine = (line?: string | null) =>
  (line ? CARE_KINDS.find((k) => k.line === line) : undefined) ?? null;

export const SOON_OPTIONS = ["Within 48 hours", "This week", "This month", "Just exploring"];

/** Which service line the page a person is reading belongs to. */
export const ROUTE_LINES: Record<string, string> = {
  "/eldercare": "eldercare",
  "/postnatal-care": "postnatal",
  "/antenatal-care": "antenatal",
  "/post-surgical-care": "post_surgical",
  "/clinical-home-care": "clinical_home_care",
  "/pediatric-care": "paediatric",
  "/nanny-childcare": "nanny_childcare",
  "/care-from-abroad": "care_from_abroad",
  "/hospital-staffing": "hospital_staffing",
  "/hospital-support": "hospital_support",
};

/** Dialling codes, Nigeria first, then the places our families most often call from. */
export const DIAL_CODES: { code: string; label: string }[] = [
  { code: "+234", label: "Nigeria" },
  { code: "+44", label: "United Kingdom" },
  { code: "+1", label: "United States / Canada" },
  { code: "+233", label: "Ghana" },
  { code: "+254", label: "Kenya" },
  { code: "+27", label: "South Africa" },
  { code: "+971", label: "United Arab Emirates" },
  { code: "+353", label: "Ireland" },
  { code: "+49", label: "Germany" },
  { code: "+33", label: "France" },
  { code: "+39", label: "Italy" },
  { code: "+31", label: "Netherlands" },
  { code: "+61", label: "Australia" },
  { code: "+966", label: "Saudi Arabia" },
  { code: "+91", label: "India" },
  { code: "+86", label: "China" },
];

export const WHATSAPP_NUMBER = "2348126988237";

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
