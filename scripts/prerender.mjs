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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const DIST = resolve("dist");
const SITE = "https://www.medicconnect.co";
const SHELL_TITLE = "<title>Medic Connect</title>";
const PAGE_TIMEOUT = 25_000;
const CONCURRENCY = 4;

const log = (...a) => console.log("[prerender]", ...a);

// 1. The shell, kept whatever happens next.
// A second run over the same build reads the shell it kept the first time,
// since index.html by then holds the pre-rendered home page.
const shell = readFileSync(join(DIST, existsSync(join(DIST, "app.html")) ? "app.html" : "index.html"), "utf8");
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
  // A blank page on the same address, so share cards can load the site's fonts.
  if (url === "/__card") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>card</title>");
    return;
  }
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

// WhatsApp shows no picture when the share image is over about 300 KB, and
// blog covers are often 2 to 10 MB. A page whose share image is large or
// stored elsewhere gets a 1200x630 JPEG copy under 280 KB, served from the
// site at /og/<page>.jpg. The picture on the page itself is untouched.
const SHARE_LIMIT = 280 * 1024;
const shareCache = new Map();
const lightCopy = async (src, name) => {
  if (shareCache.has(src)) return shareCache.get(src);
  const job = (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`share image ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());
    if (src.startsWith(SITE) && original.length <= SHARE_LIMIT) return null;
    const sharp = (await import("sharp")).default;
    let out;
    for (const quality of [78, 68, 58, 48]) {
      out = await sharp(original).rotate().resize(1200, 630, { fit: "cover", position: "attention" })
        .flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.length <= SHARE_LIMIT) break;
    }
    const rel = `og/${name}.jpg`;
    mkdirSync(join(DIST, "og"), { recursive: true });
    writeFileSync(join(DIST, rel), out);
    return `${SITE}/${rel}`;
  })().catch((e) => { log(`kept the original share image for ${name}: ${String(e?.message ?? e)}`); return null; });
  shareCache.set(src, job);
  return job;
};

const withLightShareImage = async (html, path) => {
  const src = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  if (!src || src.startsWith(`${SITE}/og/`)) return html;
  const name = path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
  const light = await lightCopy(src, name);
  if (!light) return html;
  const escaped = src.replace(/&/g, "&amp;");
  html = html.split(`content="${escaped}"`).join(`content="${light}"`);
  if (!/og:image:width/.test(html)) {
    html = html.replace(/(<meta property="og:image" content="[^"]+"[^>]*>)/,
      `$1<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg">`);
  }
  return html;
};

// Pages with no picture of their own (every page but the blog posts) used to
// share one logo card. Each now gets its own 1200x630 card, drawn in Chrome
// with the site's font: the page's title, its "from" price and its main
// picture, in the site's navy.
const DEFAULT_SHARE = `${SITE}/social-cover.png`;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const cardHtml = (base, { title, price, picture, art, logo }) => {
  const size = title.length > 70 ? 46 : title.length > 52 ? 52 : title.length > 36 ? 60 : 68;
  return `<!doctype html><html><head><base href="${base}/"><meta charset="utf-8"><style>
@font-face{font-family:F;src:url(fonts/Figtree-ExtraBold.ttf);font-weight:800}
@font-face{font-family:F;src:url(fonts/Figtree-Bold.ttf);font-weight:700}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;overflow:hidden;background:#26306B;font-family:F,sans-serif;position:relative}
.ring{position:absolute;right:-170px;bottom:-230px;width:640px;height:640px;border:96px solid #2E3878;border-radius:50%}
.logo{position:absolute;left:64px;top:56px;background:#fff;padding:14px 22px}
.logo img{height:52px;display:block}
.title{position:absolute;left:64px;top:168px;width:${picture ? 620 : 1040}px;color:#fff;font-weight:800;font-size:${size}px;line-height:1.05;letter-spacing:-0.04em}
.price{position:absolute;left:64px;bottom:62px;background:#3B4DC4;color:#fff;font-weight:800;font-size:34px;padding:10px 22px 12px;box-shadow:7px 7px 0 #fff}
.domain{position:absolute;right:70px;bottom:44px;color:#C6CBF0;font-weight:700;font-size:24px}
.pic{position:absolute;right:70px;top:84px;width:400px;height:430px;background:${art ? "#EEF1FF" : "#fff"};border:8px solid #fff;box-shadow:14px 14px 0 #3B4DC4;transform:rotate(2.5deg);overflow:hidden}
.pic img{width:100%;height:100%;object-fit:${art ? "contain" : "cover"};${art ? "padding:24px;" : ""}}
</style></head><body><div class="ring"></div>
<div class="logo"><img src="${logo}"></div>
<div class="title">${esc(title)}</div>
${price ? `<div class="price">${esc(price)}</div>` : ""}<div class="domain">medicconnect.co</div>
${picture ? `<div class="pic"><img src="${picture}"></div>` : ""}
</body></html>`;
};

const LOGO = (() => {
  try {
    const name = readdirSync(join(DIST, "assets")).find((f) => /^medicconnect-logo-[^.]+\.svg$/.test(f));
    return name ? `assets/${name}` : "favicon.png";
  } catch { return "favicon.png"; }
})();

const withShareCard = async (browser, base, html, path, picture, pictureIsArt) => {
  const src = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (src !== DEFAULT_SHARE) return html;
  const raw = unesc(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "");
  if (!raw) return html;
  // "…in Lagos, Visits from ₦20,000" keeps "Visits" with its price.
  const priced = raw.match(/,\s*([A-Z][a-z]+ from ₦[\d,]+)/) ?? raw.match(/(from ₦[\d,]+)/);
  const price = priced?.[1] ?? null;
  const title = raw
    .replace(/\s*\|\s*Medic Connect\s*$/, "").replace(/^Medic Connect\s*\|\s*/, "")
    .replace(priced?.[0] ?? "\u0000", "")
    .replace(/\s+\|\s+/g, ": ")
    .replace(/[\s,]+$/, "").trim();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1200, height: 630 });
    const pic = picture ? picture.replace(/^https?:\/\/127\.0\.0\.1:\d+\//, "") : null;
    await page.goto(`${base}/__card`);
    await page.setContent(cardHtml(base, { title, price, picture: pic, art: pictureIsArt, logo: LOGO }), { waitUntil: "load", timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.screenshot({ type: "jpeg", quality: 82 });
    const name = path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
    mkdirSync(join(DIST, "og"), { recursive: true });
    writeFileSync(join(DIST, "og", `${name}.jpg`), shot);
    const url = `${SITE}/og/${name}.jpg`;
    return html
      .split(`content="${DEFAULT_SHARE}"`).join(`content="${url}"`)
      // The card shows the page's title, so its alt text says the same.
      .replace(/(<meta (?:property="og:image:alt"|name="twitter:image:alt") content=")[^"]*(")/g, `$1${esc(title)}$2`);
  } catch (e) {
    log(`kept the site card for ${path}: ${String(e?.message ?? e).split("\n")[0]}`);
    return html;
  } finally {
    await page.close().catch(() => undefined);
  }
};

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
    // Only two things are taken from the rendered page: the <head> (its own
    // title, tags and structured data) and what is inside #root. Everything
    // else is the untouched shell. A pop-up open at capture time lives outside
    // #root and locks <body> (scroll lock, pointer-events: none, aria-hidden);
    // none of that may reach visitors, because React replaces #root but never
    // resets <body>.
    const rendered = await page.evaluate(() => {
      document.head.querySelectorAll('script[src*="googletagmanager"]').forEach((n) => n.remove());
      // The shell's site-wide fallback tags come first in <head>, and link
      // previews read the first og:title they find. Where the page set its
      // own version, the fallback goes.
      const keyOf = (m) => m.getAttribute("property") ? `p:${m.getAttribute("property")}` : m.getAttribute("name") ? `n:${m.getAttribute("name")}` : null;
      const pageKeys = new Set([...document.head.querySelectorAll("meta[data-rh]")].map(keyOf).filter(Boolean));
      document.head.querySelectorAll("meta:not([data-rh])").forEach((m) => { if (pageKeys.has(keyOf(m))) m.remove(); });
      if (document.head.querySelector("link[rel=canonical][data-rh]")) {
        document.head.querySelectorAll("link[rel=canonical]:not([data-rh])").forEach((n) => n.remove());
      }
      const root = document.getElementById("root");
      // Anything inside #root marked as an open overlay goes too.
      root.querySelectorAll('[role="dialog"], [data-radix-portal]').forEach((n) => n.remove());
      // The page's main picture, for its share card: the largest photo or
      // illustration in the first screens (never the logo or a drawn shape).
      const pictures = [...root.querySelectorAll("img")]
        .map((img) => ({ img, box: img.getBoundingClientRect() }))
        .filter(({ img, box }) => img.currentSrc && !img.currentSrc.startsWith("data:") && !/logo|\.svg/i.test(img.currentSrc)
          && box.top < 1800 && box.width > 120 && box.height > 120)
        .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
      const top = pictures[0]?.img ?? null;
      const picture = top?.currentSrc ?? null;
      // An illustration has see-through corners; it is shown whole, while a
      // photo is cropped to fill the frame.
      let pictureIsArt = false;
      try {
        if (top) {
          const c = document.createElement("canvas");
          c.width = 64; c.height = 64;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(top, 0, 0, 64, 64);
          const corners = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]];
          pictureIsArt = corners.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 250);
        }
      } catch { /* leave as photo */ }
      return { head: document.head.innerHTML, root: root.innerHTML, picture, pictureIsArt };
    });
    let html = shell
      // The shell leaves </head> implied, so the head runs up to <body.
      .replace(/<head>[\s\S]*?(?=<body)/, () => `<head>${rendered.head}</head>\n  `)
      .replace(/<div id="root"><\/div>/, () => `<div id="root">${rendered.root}</div>`);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
    const rootText = html.split('id="root"')[1]?.replace(/<[^>]+>/g, "").trim().length ?? 0;
    if (!title || title === "Medic Connect" || /not found/i.test(title) || rootText < 200) {
      return { path, ok: false, why: `title "${title}", ${rootText} characters of text` };
    }
    html = await withShareCard(browser, base, html, path, rendered.picture, rendered.pictureIsArt);
    html = await withLightShareImage(html, path);
    const file = outFile(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    // A blog post also answers at its short share link (/b/<code>), so the
    // shared link previews with the post's own title and picture.
    const short = path.startsWith("/blog/") && rendered.root.match(/www\.medicconnect\.co%2Fb%2F([a-z0-9]{6})|www\.medicconnect\.co\/b\/([a-z0-9]{6})/);
    if (short) {
      mkdirSync(join(DIST, "b"), { recursive: true });
      writeFileSync(join(DIST, "b", `${short[1] ?? short[2]}.html`), html);
    }
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
