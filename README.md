# Medic Connect

Medic Connect (care, workforce, admin): a Vite + React app on Supabase.

Heard lives in its own repository, [xoluwatosin/heard](https://github.com/xoluwatosin/heard), with its own Supabase and Vercel projects. `/heard` here redirects to heard.medicconnect.co.

Originally built in Lovable. The project has since moved off Lovable: nothing here depends on Lovable's hosting, AI gateway, connectors or package mirror.

## Local development

```sh
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:8080
```

Other scripts: `npm run build`, `npm run lint`, `npx vitest run`.

Tests that import the Supabase client need `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set. Any placeholder value works.

## Frontend environment (`.env`)

| Variable | What it is |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Supabase project (Settings → API) |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Google Maps JavaScript API key, restricted to your domains |
| `VITE_GOOGLE_MAPS_TRACKING_ID` | Optional Maps tracking ID |
| `VITE_GOOGLE_ADS_*` | Google Ads conversion IDs |

## Edge function secrets

Set these with `supabase secrets set NAME=value`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

| Secret | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | CV, document and opportunity parsing, match rationales, contract review |
| `GOOGLE_MAPS_API_KEY` | Address autocomplete (Places API (New)) |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_EMAIL` | Email sending and delivery tracking |
| `PAYSTACK_SECRET_KEY` | Invoices |
| `CRON_SECRET`, `PARSE_CV_CRON_SECRET`, `MU_LINK_SWEEP_KEY`, `RELINK_RUN_KEY` | Shared secrets for scheduled jobs |
| `SITE_URL`, `PUBLIC_SITE_URL` | Links in emails |
| `EXTRA_ALLOWED_ORIGINS` | Optional, comma-separated. Extra exact origins (staging, previews, `http://localhost:8080`) allowed by the public form functions |

## Database

Schema history lives in two places: `supabase/migrations` (older) and `drizzle/migrations` (from August 2026, run with `DATABASE_URL` set). Consolidating them into one is outstanding.
