import { SOCIAL_PROFILES } from "@/lib/social-profiles";
/**
 * Centralised Schema.org builders for AI-discoverability.
 *
 * Why: generic Service schema tells Google "this is a service".
 * MedicalBusiness / MedicalTherapy / MedicalProcedure tells ChatGPT,
 * Perplexity and Gemini *what kind* of healthcare service this is, *where*
 * it's delivered, *who it's for*, and how it maps onto recognised medical
 * concepts. AI assistants weight this heavily when picking citations for
 * health queries.
 *
 * All builders return plain JSON-LD objects ready to drop into <SEO jsonLd={...}>.
 */

const SITE = "https://www.medicconnect.co";

/** Lagos with explicit containment in Nigeria — answers the "where" question definitively. */
export const LAGOS_AREA = {
  "@type": "City",
  "name": "Lagos",
  "containedInPlace": {
    "@type": "Country",
    "name": "Nigeria",
  },
} as const;

/** Nigeria-wide area, used for services delivered beyond Lagos. */
export const NIGERIA_AREA = {
  "@type": "Country",
  "name": "Nigeria",
} as const;

/** Diaspora audience — distinguishes the buyer (overseas family) from the patient. */
export const DIASPORA_AUDIENCE = {
  "@type": "PeopleAudience",
  "name": "Nigerian diaspora",
  "geographicArea": [
    { "@type": "Country", "name": "United Kingdom" },
    { "@type": "Country", "name": "United States" },
    { "@type": "Country", "name": "Canada" },
    { "@type": "Country", "name": "Germany" },
  ],
} as const;

/** Brand provider block reused across every service schema. */
export const PROVIDER = {
  "@type": "MedicalOrganization",
  "name": "Medic Connect",
  "url": SITE,
  "telephone": "+234 812 698 8237",
  "email": "hello@medicconnect.co",
  "areaServed": LAGOS_AREA,
  "memberOf": {
    "@type": "Organization",
    "name": "Healthcare Federation of Nigeria",
    "url": "https://hfnigeria.com",
  },
} as const;

interface MedicalServiceInput {
  name: string;
  path: string;
  description: string;
  /** Schema.org MedicalSpecialty value: e.g. "Geriatric", "Obstetric", "Surgical", "Pediatric". */
  specialty: string;
  /** Patient-facing audience description, e.g. "Post-surgical patients in Lagos". */
  audienceType: string;
  /** Optional pricing block. */
  offers?: {
    lowPrice: string | number;
    highPrice: string | number;
    offerCount: string | number;
    description: string;
  };
  /** Optional list of related medical procedures to surface to LLMs. */
  relatedProcedures?: string[];
  /** Whether to include diaspora audience alongside the patient audience. */
  includeDiaspora?: boolean;
}

/**
 * Build a MedicalTherapy/MedicalBusiness schema for a service hub page.
 * MedicalTherapy is the most specific Schema.org type for skilled in-home care.
 */
export function medicalServiceSchema(input: MedicalServiceInput) {
  const audience: Record<string, unknown>[] = [
    {
      "@type": "MedicalAudience",
      "audienceType": input.audienceType,
      "geographicArea": LAGOS_AREA,
    },
  ];
  if (input.includeDiaspora) {
    audience.push(DIASPORA_AUDIENCE as unknown as Record<string, unknown>);
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["MedicalTherapy", "Service"],
    "name": input.name,
    "url": `${SITE}${input.path}`,
    "description": input.description,
    "provider": PROVIDER,
    "areaServed": LAGOS_AREA,
    "medicalSpecialty": input.specialty,
    "audience": audience,
    "availableService": input.relatedProcedures?.map((procedure) => ({
      "@type": "MedicalProcedure",
      "name": procedure,
    })),
  };

  if (input.offers) {
    schema.offers = {
      "@type": "AggregateOffer",
      "priceCurrency": "NGN",
      "lowPrice": String(input.offers.lowPrice),
      "highPrice": String(input.offers.highPrice),
      "offerCount": String(input.offers.offerCount),
      "priceSpecification": {
        "@type": "PriceSpecification",
        "priceCurrency": "NGN",
        "description": input.offers.description,
      },
    };
  }

  // Strip undefined keys so the JSON stays clean for crawlers.
  Object.keys(schema).forEach((k) => schema[k] === undefined && delete schema[k]);
  return schema;
}

/** FAQPage schema for service hub pages. */
export function faqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };
}

/**
 * MedicalBusiness root schema for the homepage.
 * Upgrades the previous LocalBusiness to a regulated-healthcare type, with
 * explicit specialties and audience.
 */
export function medicalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "LocalBusiness", "MedicalOrganization"],
    "name": "Medic Connect",
    "image": "https://www.medicconnect.co/favicon.png",
    "url": SITE,
    "telephone": "+234 812 698 8237",
    "email": "hello@medicconnect.co",
    "priceRange": "₦₦",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Lagos",
      "addressRegion": "Lagos State",
      "addressCountry": "NG",
    },
    "areaServed": [LAGOS_AREA, NIGERIA_AREA],
    "medicalSpecialty": [
      "Geriatric",
      "Obstetric",
      "Pediatric",
      "Surgical",
      "Nursing",
    ],
    "audience": [
      {
        "@type": "MedicalAudience",
        "audienceType": "Patients receiving care at home in Lagos",
      },
      DIASPORA_AUDIENCE,
    ],
    "description":
      "Healthcare staffing and skilled in-home care across Lagos: vetted nurses, Omugwo specialists, post-surgical recovery, eldercare and paediatric care. Insured, HEFAMAA-accredited, and a member of the Healthcare Federation of Nigeria.",
    "memberOf": {
      "@type": "Organization",
      "name": "Healthcare Federation of Nigeria",
      "url": "https://hfnigeria.com",
    },
    "sameAs": SOCIAL_PROFILES,
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Medic Connect Care Services",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "MedicalTherapy", "name": "Omugwo & Postnatal Care", "url": `${SITE}/postnatal-care` } },
        { "@type": "Offer", "itemOffered": { "@type": "MedicalTherapy", "name": "Post-Surgical Home Care", "url": `${SITE}/post-surgical-care` } },
        { "@type": "Offer", "itemOffered": { "@type": "MedicalTherapy", "name": "Eldercare & Companion Care", "url": `${SITE}/eldercare` } },
        { "@type": "Offer", "itemOffered": { "@type": "MedicalTherapy", "name": "Pediatric & Special Needs Care", "url": `${SITE}/pediatric-care` } },
        { "@type": "Offer", "itemOffered": { "@type": "MedicalTherapy", "name": "Antenatal Care at Home", "url": `${SITE}/antenatal-care` } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Care from Abroad (Diaspora)", "url": `${SITE}/care-from-abroad` } },
      ],
    },
  };
}
