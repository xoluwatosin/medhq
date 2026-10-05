// Emails to families along the care journey, in journey order. Each takes
// plain values and returns the subject and the finished HTML, so whichever
// function sends it (a staff action today, an automatic step later) says the
// same thing in the same look.

import {
  KIT_ART, kitButton, kitEmail, kitFacts, kitList, kitNotice, kitParagraph, kitSteps, kitSubhead,
} from "./kit-email.ts";

const WHATSAPP = "+234 812 698 8237";
const FOOTNOTE = "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.";

const first = (name: string) => String(name ?? "").trim().split(/\s+/)[0] || "there";

export interface RenderedEmail { subject: string; html: string }

/** 2. A care needs assessment is in the diary. */
export function assessmentBookedEmail(o: {
  /** Who the email is to. */
  recipientName: string;
  /** Who the care is for, as the family says it: "your mother", "Mama Bisi". */
  personName: string;
  /** "Thursday 9 October" */
  date: string;
  /** "10:00 to 11:30" */
  time: string;
  /** "Nurse Adaeze Okafor, registered nurse" */
  visitor: string;
  address: string;
  /** How the fee is paid, when the team has a set way. */
  feeNote?: string;
}): RenderedEmail {
  const subject = `Your care needs assessment is booked for ${o.date}`;
  const bodyHtml = [
    kitParagraph(`Dear ${first(o.recipientName)},`),
    kitParagraph(`A nurse is coming to see ${o.personName} at home, to understand the care needed. Here are the details.`),
    kitFacts([
      { label: "Date", value: o.date },
      { label: "Time", value: o.time },
      { label: "Who is coming", value: o.visitor },
      { label: "Where", value: o.address },
    ]),
    kitSubhead("What to have ready"),
    kitList([
      "Medicines in their packets, and any prescriptions.",
      "Recent hospital letters, discharge notes or test results.",
      "The names and numbers of any doctors involved.",
      "Someone who knows the daily routine, if they can be there.",
    ]),
    kitParagraph("The nurse will want to see where the person sleeps, washes and eats, so the plan fits the home."),
    kitSubhead("The fee"),
    kitNotice(`The assessment costs **₦35,000**. ${o.feeNote ?? "Your coordinator will tell you how to pay before the visit."}`),
    kitSubhead("After the visit"),
    kitSteps([
      { title: "Your care plan", detail: "The nurse writes the care plan from what they learn. We send it to you to read." },
      { title: "A match", detail: "A carer chosen for the plan and the person." },
      { title: "Care begins", detail: "On the days you agree." },
    ]),
    kitParagraph(`Need to change the time? Reply to this email or message us on WhatsApp on ${WHATSAPP}.`),
    kitParagraph("The Medic Connect care team"),
  ].join("");

  return {
    subject,
    html: kitEmail({
      eyebrow: "Care needs assessment",
      title: "Your assessment is booked",
      accent: "booked",
      art: KIT_ART.nurse,
      standfirst: `${o.date}, ${o.time}.`,
      preheader: `${o.visitor} is coming on ${o.date}, ${o.time}.`,
      bodyHtml,
      footnote: FOOTNOTE,
    }),
  };
}

/** 4. The care plan is written and waiting for the family to read. */
export function carePlanReadyEmail(o: {
  recipientName: string;
  personName: string;
  /** The family page that opens the plan. */
  url: string;
}): RenderedEmail {
  const subject = `The care plan for ${o.personName} is ready to read`;
  const bodyHtml = [
    kitParagraph(`Dear ${first(o.recipientName)},`),
    kitParagraph(`We have written the care plan for ${o.personName}, from what we learned at the assessment. It is ready for you to read.`),
    kitButton("Read the care plan", o.url),
    kitSubhead("When you read it"),
    kitSteps([
      { title: "Read it", detail: "It sets out the care, the days and who is coming." },
      { title: "Tell us", detail: "Agree, ask for changes, or ask for a call. You reply on the same page." },
      { title: "Care begins", detail: "Once you agree, we confirm the start date with you. The cost is in your quotation." },
    ]),
    kitNotice("You sign in with this email address. We send you a secure link, so there is no password to remember."),
    kitParagraph(`Questions about the plan? Reply to this email or message us on WhatsApp on ${WHATSAPP}.`),
    kitParagraph("The Medic Connect care team"),
  ].join("");

  return {
    subject,
    html: kitEmail({
      eyebrow: "Your care",
      title: "Your care plan is ready",
      accent: "ready",
      art: KIT_ART.carePlan,
      standfirst: `The plan for ${o.personName}.`,
      preheader: "Read it, then agree, ask for changes or ask for a call.",
      bodyHtml,
      footnote: FOOTNOTE,
    }),
  };
}
