import { Helmet } from "react-helmet-async";

const SITE_URL = "https://heard.medicconnect.co";
// No Heard share image yet; the Medic Connect cover is used until one exists.
const DEFAULT_IMAGE = "https://www.medicconnect.co/social-cover.png";

// Friendly labels for BreadcrumbList — keeps crawlers and AI assistants on-brand.
const PATH_LABELS: Record<string, string> = {
  "/": "Home",
  "/write": "Write to us",
  "/story-swap": "Story Swap",
  "/letters": "Letter Room",
  "/letters/leave": "Leave a letter",
  "/talk": "Talk",
  "/about": "About",
  "/support": "Support",
  "/privacy": "Privacy",
  "/get-involved": "Get involved",
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

const SEO = ({ title, description, path, image = DEFAULT_IMAGE, type = "website", jsonLd, breadcrumbs, noindex, canonicalPath }: SEOProps) => {
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
      <meta name="twitter:card" content="summary_large_image" />
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
