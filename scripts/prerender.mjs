// Pre-renders every sitemap page into static HTML after `vite build`.
//
// The site is a single-page app: without this, every URL answers with the
// same empty shell titled "Medic Connect", and only browsers that run the
// JavaScript see the real title, description, canonical and text. Link
// previews (WhatsApp, LinkedIn, X), Bing and the AI crawlers do not run it.
//
// What it does:
//   1. Keeps the empty shell as dist/app.html. vercel.json sends every route
//      that has no file of its own there (admin, portal, care links, posts).
//   2. Serves dist locally, opens each sitemap URL in headless Chrome, waits
//      until the page has set its own title, and saves the finished HTML as
//      dist/<path>.html (cleanUrls serves it at /<path>). React then takes
//      over in the browser exactly as before.
//
// It never fails the build: if Chrome cannot start or a page will not
// render, that page keeps the shell and the site works as it did.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const DIST = resolve("dist");
const SITE = "https://www.medicconnect.co";
const SHELL_TITLE = "<title>Medic Connect</title>";
const PAGE_TIMEOUT = 25_000;
const CONCURRENCY = 4;

const log = (...a) => console.log("[prerender]", ...a);

// 1. The shell, kept whatever happens next.
const shell = readFileSync(join(DIST, "index.html"), "utf8");
writeFileSync(join(DIST, "app.html"), shell);

const paths = [...readFileSync(join(DIST, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(SITE, "") || "/")
  .filter((p, i, all) => all.indexOf(p) === i);

const TYPES = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain", ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

// A static server with the same fallback Vercel uses: a file if there is one,
// otherwise the shell.
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = join(DIST, url);
  if (url !== "/" && file.startsWith(DIST) && existsSync(file) && extname(file)) {
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(shell);
});

// Chrome pauses painting in tabs it treats as hidden, and the title library
// writes the title on the next paint, so several tabs at once would keep the
// shell's title. These switches keep every tab running.
const KEEP_AWAKE = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
];

const launch = async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.PRERENDER_CHROME) {
    return puppeteer.launch({ executablePath: process.env.PRERENDER_CHROME, args: ["--no-sandbox", ...KEEP_AWAKE] });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({ args: [...chromium.args, ...KEEP_AWAKE], executablePath: await chromium.executablePath(), headless: true });
};

const outFile = (path) => (path === "/" ? join(DIST, "index.html") : join(DIST, `${path.replace(/^\//, "")}.html`));

const renderOne = async (browser, base, path) => {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 900 });
    // No first-visit welcome sheet in the saved page.
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem("mc-welcome-seen", "1"); } catch { /* ignore */ }
      window.__PRERENDER__ = true;
      // Belt and braces for the paint pause: run paint callbacks on a timer.
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
    });
    // Analytics and live chat never load during the build.
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const u = r.url();
      if (/googletagmanager|google-analytics|vercel\.live|facebook|hotjar|clarity/.test(u)) r.abort();
      else r.continue();
    });
    await page.goto(base + path, { waitUntil: "networkidle0", timeout: PAGE_TIMEOUT });
    // The page has rendered when it has replaced the shell's title.
    await page.waitForFunction(() => document.title && document.title !== "Medic Connect", { timeout: 8_000 })
      .catch(() => undefined);
    const html = await page.evaluate(() => {
      // Drop anything injected for the session only.
      document.querySelectorAll('script[src*="googletagmanager"], [data-radix-portal], [role="dialog"]').forEach((n) => n.remove());
      // The shell's site-wide fallback tags come first in <head>, and link
      // previews read the first og:title they find. Where the page set its
      // own version, the fallback goes.
      const keyOf = (m) => m.getAttribute("property") ? `p:${m.getAttribute("property")}` : m.getAttribute("name") ? `n:${m.getAttribute("name")}` : null;
      const pageKeys = new Set([...document.head.querySelectorAll("meta[data-rh]")].map(keyOf).filter(Boolean));
      document.head.querySelectorAll("meta:not([data-rh])").forEach((m) => { if (pageKeys.has(keyOf(m))) m.remove(); });
      if (document.head.querySelector("link[rel=canonical][data-rh]")) {
        document.head.querySelectorAll("link[rel=canonical]:not([data-rh])").forEach((n) => n.remove());
      }
      return "<!doctype html>\n" + document.documentElement.outerHTML;
    });
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
    const rootText = html.split('id="root"')[1]?.replace(/<[^>]+>/g, "").trim().length ?? 0;
    if (!title || title === "Medic Connect" || /not found/i.test(title) || rootText < 200) {
      return { path, ok: false, why: `title "${title}", ${rootText} characters of text` };
    }
    const file = outFile(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    return { path, ok: true, title };
  } catch (e) {
    return { path, ok: false, why: String(e?.message ?? e).split("\n")[0] };
  } finally {
    await page.close().catch(() => undefined);
  }
};

const main = async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await launch();
  } catch (e) {
    log("Chrome did not start, so pages stay as the shell:", String(e?.message ?? e).split("\n")[0]);
    return;
  }
  const queue = [...paths];
  const results = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await renderOne(browser, base, queue.shift()));
  }));
  await browser.close().catch(() => undefined);
  const failed = results.filter((r) => !r.ok);
  log(`${results.length - failed.length} of ${results.length} pages pre-rendered.`);
  for (const f of failed) log(`kept the shell for ${f.path}: ${f.why}`);
};

main()
  .catch((e) => log("stopped early, remaining pages stay as the shell:", e))
  .finally(() => server.close());
