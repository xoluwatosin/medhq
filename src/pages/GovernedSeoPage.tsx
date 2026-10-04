import { useLocation } from "react-router-dom";
import SeoPage, { type SeoKind } from "@/components/mc/SeoPage";
import { HERO_ART, photoFor } from "@/content/seo/seo-look";
import { GOVERNED_PAGE_BY_PATH, type GovernedPage } from "@/content/seo/governed-pages";
import { PAGE_VISUALS } from "@/content/seo/page-visuals";
import { GOVERNED_FEES, GOVERNED_MODULES } from "@/content/seo/governed-modules";
import { art } from "@/components/mc/art";
import NotFound from "@/pages/NotFound";

const serviceSchema = (page: GovernedPage) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: page.h1,
  description: page.metaDescription,
  provider: {
    "@type": "Organization",
    name: "Medic Connect",
    url: "https://www.medicconnect.co",
  },
  areaServed: ["Lagos", "Abuja", "Ogun State", "Oyo State"].map((name) => ({ "@type": "Place", name })),
});

const breadcrumbSchema = (page: GovernedPage) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.medicconnect.co/" },
    { "@type": "ListItem", position: 2, name: page.h1, item: `https://www.medicconnect.co${page.path}` },
  ],
});

/** Pages addressed to candidates: they offer joining the network, never a care request. */
const CANDIDATE_PATHS = new Set(["/careers", "/careers/nursing"]);

/** Pages addressed to employers: they offer a staffing conversation, never joining the network. */
const EMPLOYER_PATHS = new Set(["/nurse-staffing", "/ngo-healthcare-staffing"]);

const heroTag = (path: string) =>
  CANDIDATE_PATHS.has(path)
    ? "Careers"
    : EMPLOYER_PATHS.has(path)
      ? "For facilities"
      : path.startsWith("/guides/")
        ? "Guide"
        : path === "/event-medical-cover"
          ? "For organisers"
          : "Care at home";

/** Approved, registry-backed reasons. No new claim is introduced here. */
const BENEFITS = [
  {
    title: "Licensed and accredited",
    description: "Licensed and accredited by HEFAMAA, with professional indemnity insurance and membership of the Healthcare Federation of Nigeria.",
  },
  {
    title: "Vetted professionals",
    description: "Identity, registration and qualification documents are collected and reviewed, with references, interview and competency assessment.",
  },
  {
    title: "Assessment first",
    description: "A formal assessment sets the care plan, the professionals required and the hours before care begins.",
  },
  {
    title: "Documented care",
    description: "Care is documented against the care plan and reviewed as circumstances change.",
  },
  {
    title: "Clear escalation",
    description: "Staff work to documented escalation procedures. Medic Connect is not an emergency service.",
  },
  {
    title: "Lagos, Abuja, Ogun and Oyo",
    description: "Care is arranged in the areas Medic Connect currently serves.",
  },
];

const GovernedSeoPage = () => {
  const { pathname } = useLocation();
  const page = GOVERNED_PAGE_BY_PATH[pathname];

  if (!page) return <NotFound />;

  const visuals = PAGE_VISUALS[page.path];
  const isCandidate = CANDIDATE_PATHS.has(page.path);
  const isEmployer = EMPLOYER_PATHS.has(page.path);
  const kind: SeoKind = isCandidate ? "jobs" : isEmployer ? "staffing" : page.path.startsWith("/guides/") ? "guide" : "care";

  return (
    <SeoPage
      path={page.path}
      kind={kind}
      eyebrow={heroTag(page.path)}
      title={page.title}
      metaDescription={page.metaDescription}
      jsonLd={[serviceSchema(page), breadcrumbSchema(page)]}
      h1={page.h1}
      promise={page.promise}
      heroArt={HERO_ART[page.path] ?? [isCandidate ? art.charCaregiver : isEmployer ? art.charDoctor : art.charNurse]}
      photo={photoFor(page.path, kind)}
      answer={{ heading: "What this covers", paragraphs: page.intro, points: [] }}
      audience={
        visuals && { title: isCandidate ? "Who we engage" : isEmployer ? "Who we staff" : "Who this is for", entries: visuals.audience }
      }
      included={
        visuals && {
          title: isCandidate ? "Routes into work" : isEmployer ? "How we staff" : "What is included",
          cards: visuals.cards,
        }
      }
      fees={page.feeSkus.map((sku) => GOVERNED_FEES[sku]).filter((f) => f && f.sku !== "PUB-ASSESSMENT")}
      modules={page.moduleCodes.map((code) => GOVERNED_MODULES[code]).filter(Boolean)}
      reasons={BENEFITS}
      bandPerson={isCandidate ? art.charCaregiver : isEmployer ? art.charDoctor : art.charNurse}
    />
  );
};

export default GovernedSeoPage;
