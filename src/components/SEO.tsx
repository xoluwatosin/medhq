import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.medicconnect.co";
const DEFAULT_IMAGE = `${SITE_URL}/social-cover.png`;
/** The default share card is 1200 by 630; previews draw it at once when they know. */
const DEFAULT_IMAGE_SIZE = { width: "1200", height: "630" };
const DEFAULT_IMAGE_ALT = "Medic Connect: care at home and healthcare staffing across Lagos";


// Friendly labels for BreadcrumbList — keeps crawlers and AI assistants on-brand.
const PATH_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/contact": "Contact",
  "/join": "Join Our Network",
  "/blog": "The Bridge",
  "/creator": "Creator Programme",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/clinical-home-care": "Clinical Home Care",
  "/antenatal-care": "Antenatal Care at Home",
  "/postnatal-care": "Postnatal Care & Omugwo",
  "/nanny-childcare": "Nanny & Childcare",
  "/eldercare": "Eldercare & Companion Care",
  "/pediatric-care": "Pediatric & Special Needs Care",
  "/hospital-staffing": "Hospital & Corporate Staffing",
  "/hospital-support": "Hospital Support Services",
  "/clinical-research": "Clinical Research & Support",
  "/post-surgical-care": "Post-Surgical Home Care",
  "/care-from-abroad": "Care from Abroad",
  "/agency-vs-private-nurse-lagos": "Agency vs Private Nurse in Lagos",
  "/home-care-ikoyi": "Home Care in Ikoyi",
  "/home-care-lekki": "Home Care in Lekki",
  "/home-care-victoria-island": "Home Care in Victoria Island",
  "/home-care-ikeja": "Home Care in Ikeja",
  "/home-care-ajah": "Home Care in Ajah",
  "/home-care-surulere": "Home Care in Surulere",
  "/home-care-yaba": "Home Care in Yaba",
  "/home-care-banana-island": "Home Care in Banana Island",
  "/home-care-parkview": "Home Care in Parkview Estate",
  "/home-care-osborne-foreshore": "Home Care in Osborne Foreshore",
  "/home-care-eko-atlantic": "Home Care in Eko Atlantic",
  "/home-care-lekki-phase-1": "Home Care in Lekki Phase 1",
  "/home-care-vgc": "Home Care in VGC",
  "/home-care-ikeja-gra": "Home Care in Ikeja GRA",
  "/home-care-magodo-gra": "Home Care in Magodo GRA",
};

interface BreadcrumbCrumb {
  name: string;
  path: string;
}

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Override the auto-generated breadcrumb trail. Pass [] to disable. */
  breadcrumbs?: BreadcrumbCrumb[];
  noindex?: boolean;
  /** The URL that owns this topic, when it is not this page. */
  canonicalPath?: string;
  /** Alt text for a custom share image. */
  imageAlt?: string;
  /** Articles: when it was first published and last changed (ISO dates). */
  publishedTime?: string;
  modifiedTime?: string;
}


function buildBreadcrumbs(path: string): BreadcrumbCrumb[] {
  if (path === "/" || !path) return [];
  const segments = path.split("/").filter(Boolean);
  const crumbs: BreadcrumbCrumb[] = [{ name: "Home", path: "/" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    const name = PATH_LABELS[acc] ?? seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ name, path: acc });
  }
  return crumbs;
}

function breadcrumbListSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

const SEO = ({
  title, description, path, image = DEFAULT_IMAGE, type = "website", jsonLd, breadcrumbs, noindex, canonicalPath,
  imageAlt, publishedTime, modifiedTime,
}: SEOProps) => {
  const isDefaultImage = image === DEFAULT_IMAGE;
  const alt = imageAlt ?? (isDefaultImage ? DEFAULT_IMAGE_ALT : title);
  const url = `${SITE_URL}${path}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath ?? path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? [...jsonLd] : [jsonLd]) : [];

  const crumbs = breadcrumbs ?? buildBreadcrumbs(path);
  if (crumbs.length > 1) {
    ldArray.push(breadcrumbListSchema(crumbs));
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content={canonicalPath ? "noindex, follow" : "noindex, nofollow"} />}
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={title} />

      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={alt} />
      {isDefaultImage && <meta property="og:image:width" content={DEFAULT_IMAGE_SIZE.width} />}
      {isDefaultImage && <meta property="og:image:height" content={DEFAULT_IMAGE_SIZE.height} />}
      <meta property="og:site_name" content="Medic Connect" />
      <meta property="og:locale" content="en_NG" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@MedicConnectHQ" />
      <meta name="twitter:image:alt" content={alt} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
