import { useLocation } from "react-router-dom";
import SeoPage from "@/components/mc/SeoPage";
import { HERO_ART, photoFor } from "@/content/seo/seo-look";
import { isExpansionIndexable } from "@/content/seo/index-policy";
import { EXPANSION_PAGE_BY_PATH, type ExpansionPage } from "@/content/seo/expansion-pages";
import { GOVERNED_FEES, GOVERNED_MODULES } from "@/content/seo/governed-modules";
import { art } from "@/components/mc/art";
import NotFound from "@/pages/NotFound";

const TALENT_TEMPLATES = new Set(["jobs", "staffing"]);

/** The notch tag above each hero, by template. */
const HERO_TAG: Record<ExpansionPage["template"], string> = {
  care: "Care at home",
  childcare: "Childcare",
  staffing: "For facilities",
  jobs: "Careers",
  guide: "Guide",
};

/** The person on the navy band, by template (and in the hero when a page has no art of its own). */
const TEMPLATE_PERSON: Record<ExpansionPage["template"], string> = {
  care: art.charNurse,
  childcare: art.charBoy,
  staffing: art.charDoctor,
  jobs: art.charCaregiver,
  guide: art.charCaregiver,
};

const BENEFITS = [
  { title: "HEFAMAA accredited", description: "Licensed and compliant with Lagos State health requirements." },
  { title: "Vetted professionals", description: "Identity, qualifications, registration and competency are reviewed for the role." },
  { title: "Assessment-led", description: "The assessment determines the plan, professional scope and service arrangement." },
  { title: "Coordinated support", description: "A named Medic Connect contact coordinates managed care and documented escalation." },
];

const pageSchema = (page: ExpansionPage) => [
  {
    "@context": "https://schema.org",
    "@type": page.template === "guide" ? "Article" : "Service",
    name: page.h1,
    headline: page.h1,
    description: page.metaDescription,
    provider: {
      "@type": "Organization",
      name: "Medic Connect",
      url: "https://www.medicconnect.co",
    },
    areaServed: ["Lagos", "Abuja", "Ogun State", "Oyo State"].map((name) => ({ "@type": "Place", name })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.medicconnect.co/" },
      { "@type": "ListItem", position: 2, name: page.h1, item: `https://www.medicconnect.co${page.path}` },
    ],
  },
];

const ExpansionSeoPage = () => {
  const { pathname } = useLocation();
  const page = EXPANSION_PAGE_BY_PATH[pathname];

  if (!page) return <NotFound />;

  const isTalent = TALENT_TEMPLATES.has(page.template);
  const isEmployer = page.template === "staffing";
  // Some records reuse the direct answer as their first card, and guides repeat
  // their answer points as the checklist; show each piece of copy once.
  const cards = page.cards.filter((card) => !page.intro.includes(card.description));
  const answerPoints = page.checklist ? [] : page.answerPoints;

  return (
    <SeoPage
      path={page.path}
      kind={page.template}
      eyebrow={HERO_TAG[page.template]}
      title={page.title}
      metaDescription={page.metaDescription}
      jsonLd={pageSchema(page)}
      noindex={!isExpansionIndexable(page.path)}
      h1={page.h1}
      promise={page.promise}
      heroArt={HERO_ART[page.path] ?? [TEMPLATE_PERSON[page.template]]}
      photo={photoFor(page.path, page.template)}
      answer={{ heading: page.answerHeading, paragraphs: page.intro, points: answerPoints }}
      audience={{ title: isTalent ? (isEmployer ? "Who we staff" : "Who we engage") : "Who this is for", entries: page.audience }}
      comparison={page.comparison}
      checklist={page.checklist}
      included={{ title: page.template === "jobs" ? "Routes into work" : isEmployer ? "How we staff" : "What is included", cards }}
      fees={page.feeSkus.map((sku) => GOVERNED_FEES[sku]).filter((f) => f && f.sku !== "PUB-ASSESSMENT")}
      modules={page.moduleCodes.map((code) => GOVERNED_MODULES[code]).filter(Boolean)}
      reasons={BENEFITS}
      bandPerson={TEMPLATE_PERSON[page.template]}
      related={page.related}
    />
  );
};

export default ExpansionSeoPage;
