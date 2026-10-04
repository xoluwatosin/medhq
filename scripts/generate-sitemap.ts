// Generates public/sitemap.xml. Wired via predev/prebuild npm scripts.
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://www.medicconnect.co";
// Only routes approved for indexing in the governed index policy enter the sitemap.
const policySource = readFileSync(resolve("src/content/seo/index-policy.ts"), "utf8");
const indexableBlock = policySource.match(/INDEXABLE_EXPANSION_PATHS: string\[\] = \[([\s\S]*?)\];/);
const expansionPaths = indexableBlock
  ? [...indexableBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
  : [];

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  lastmod?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.8" },
  { path: "/join", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/clinical-home-care", changefreq: "monthly", priority: "0.9" },
  { path: "/antenatal-care", changefreq: "monthly", priority: "0.9" },
  { path: "/postnatal-care", changefreq: "monthly", priority: "0.9" },
  { path: "/post-surgical-care", changefreq: "monthly", priority: "0.9" },
  { path: "/nanny-childcare", changefreq: "monthly", priority: "0.9" },
  { path: "/eldercare", changefreq: "monthly", priority: "0.9" },
  { path: "/pediatric-care", changefreq: "monthly", priority: "0.9" },
  { path: "/hospital-staffing", changefreq: "monthly", priority: "0.9" },
  { path: "/hospital-support", changefreq: "monthly", priority: "0.9" },
  { path: "/clinical-research", changefreq: "monthly", priority: "0.9" },
  { path: "/care-from-abroad", changefreq: "monthly", priority: "0.9" },
  { path: "/agency-vs-private-nurse-lagos", changefreq: "monthly", priority: "0.9" },
  // Neighbourhood landing pages — local SEO surface
  { path: "/home-care-ikoyi", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-lekki", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-victoria-island", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-ikeja", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-ajah", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-surulere", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-yaba", changefreq: "monthly", priority: "0.9" },
  { path: "/home-care-banana-island", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-parkview", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-osborne-foreshore", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-eko-atlantic", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-lekki-phase-1", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-vgc", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-ikeja-gra", changefreq: "monthly", priority: "0.8" },
  { path: "/home-care-magodo-gra", changefreq: "monthly", priority: "0.8" },
  { path: "/heard", changefreq: "weekly", priority: "0.8" },
  { path: "/creator", changefreq: "monthly", priority: "0.7" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  // Governed SEO pages composed from approved modules and public fees.
  { path: "/24-hour-nursing-care", changefreq: "monthly", priority: "0.9" },
  { path: "/care-at-home", changefreq: "monthly", priority: "0.9" },
  { path: "/careers", changefreq: "weekly", priority: "0.8" },
  { path: "/careers/nursing", changefreq: "weekly", priority: "0.8" },
  { path: "/caregiver", changefreq: "monthly", priority: "0.9" },
  { path: "/catheter-care-at-home", changefreq: "monthly", priority: "0.9" },
  { path: "/chronic-care-at-home", changefreq: "monthly", priority: "0.9" },
  { path: "/doctor-home-visits", changefreq: "monthly", priority: "0.9" },
  { path: "/event-medical-cover", changefreq: "monthly", priority: "0.8" },
  { path: "/for-facilities", changefreq: "monthly", priority: "0.8" },
  { path: "/guides/what-does-an-omugwo-caregiver-do", changefreq: "monthly", priority: "0.7" },
  { path: "/newborn-care", changefreq: "monthly", priority: "0.9" },
  { path: "/ngo-healthcare-staffing", changefreq: "monthly", priority: "0.8" },
  { path: "/nurse-staffing", changefreq: "monthly", priority: "0.8" },
  { path: "/omugwo", changefreq: "monthly", priority: "0.9" },
  { path: "/palliative-care-at-home", changefreq: "monthly", priority: "0.9" },
  { path: "/physiotherapy-at-home", changefreq: "monthly", priority: "0.9" },
  ...expansionPaths.map((path) => ({ path, changefreq: "monthly" as const, priority: "0.8" })),
];

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?select=slug,published_at&status=eq.published&order=published_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return [];
    const rows: Array<{ slug: string; published_at: string }> = await res.json();
    const now = new Date().toISOString();
    return rows
      .filter((r) => r.published_at <= now)
      .map((r) => ({
        path: `/blog/${r.slug}`,
        lastmod: r.published_at.split("T")[0],
        changefreq: "monthly" as const,
        priority: "0.7",
      }));
  } catch {
    return [];
  }
}

function buildXml(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const blog = await fetchBlogEntries();
  const all = [...new Map([...staticEntries, ...blog].map((entry) => [entry.path, entry])).values()];
  writeFileSync(resolve("public/sitemap.xml"), buildXml(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
})();
