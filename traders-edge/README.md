# Trader's Edge — Production Web App

A Next.js full-stack app: define your trading edge, score chart screenshots
against it with AI (verdict-in-one-glance), with auth, database, payments, and
usage caps. Built to deploy on Vercel.

## What's included

- **Auth + database** — Supabase (Google + magic-link login, Postgres with Row Level Security)
- **Verdict-in-one-glance** — the AI returns a big TRADE / REDUCE / SKIP banner first, detail on demand
- **Payments** — Stripe Checkout + webhook that flips users to Pro
- **Legal pages** — Terms, Privacy, Risk Disclaimer (linked before charging)
- **Security** — Anthropic + Stripe secret keys stay server-side; no card data stored; per-user AI usage cap

## Architecture

```
Browser (Next.js client)
  → /api/analyze        → Anthropic (server-side, key hidden, usage-capped)
  → /api/stripe/checkout → Stripe Checkout
  ← /api/stripe/webhook ← Stripe (flips plan to Pro in Supabase)
  → Supabase (auth + edges + trades, protected by RLS)
```

---

## Setup runbook

### 1. Install
```bash
npm install
cp .env.example .env.local   # then fill in real values (see below)
```

### 2. Supabase (auth + database)
1. Create a project at supabase.com
2. Project Settings → API → copy the URL, anon key, and service_role key into `.env.local`
3. SQL Editor → paste the contents of `supabase-schema.sql` → Run
4. Authentication → Providers → enable Email, and Google (add OAuth credentials)
5. Authentication → URL Configuration → add `http://localhost:3000/auth/callback` and your production URL

### 3. Anthropic (AI)
1. Get an API key at console.anthropic.com
2. Put it in `ANTHROPIC_API_KEY` (server-only — never prefixed NEXT_PUBLIC)
3. In the Anthropic console, set a monthly usage limit + billing alerts as your outer cost ceiling.

### 3b. Abuse & cost protection (Upstash Redis — recommended for production)
Powers rate limiting and the global daily spend cap. Without it, both degrade to
"allow" (fine for local dev; set it before launch).
1. Create a free database at upstash.com → Redis
2. Copy the REST URL and REST token into `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. Tune `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, `DAILY_ANALYSIS_CAP`, `MAX_IMAGE_MB` to taste

The `/api/analyze` route enforces, in order: login → per-user & per-IP rate limit
→ global daily cap → per-user free cap → image-size guard → only then the paid AI call.

### 4. Stripe (payments)
1. Create two recurring Products (Monthly $12, Annual $89) → copy each price ID
2. Developers → API keys → copy publishable + secret keys
3. Developers → Webhooks → add endpoint `https://YOURDOMAIN/api/stripe/webhook`,
   subscribe to `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` → copy the
   signing secret
4. Fill all STRIPE_* vars in `.env.local`
5. **Customer Portal** — Settings → Billing → Customer portal → configure it
   (enable cancellation, invoice history, payment method updates). The portal
   is what users land on when they click "Manage subscription" in app. Without
   this step, the Settings page can't open the portal.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### 4b. Resend (transactional email — optional but recommended)
The app sends three transactional emails: welcome (on first edge-builder load),
cap-warning (when a free user uses their 2nd of 3 analyses), and cancellation
(when Stripe deletes a subscription). If `RESEND_API_KEY` is not set the app
logs intended sends to the server console instead of delivering — useful for
local development.

1. Sign up at resend.com → add and verify your sending domain
2. Create an API key → set `RESEND_API_KEY` in `.env.local`
3. Set `EMAIL_FROM="Trader's Edge <hello@your-verified-domain.com>"`

### 5. Run
```bash
npm run dev      # http://localhost:3000
```

### 6. Deploy to Vercel
1. Push this folder to a GitHub repo
2. Import it at vercel.com → add all `.env.local` vars in Project Settings → Environment Variables
3. Set `NEXT_PUBLIC_SITE_URL` to your real domain
4. Deploy. Update the Stripe webhook URL and Supabase redirect URL to the live domain.

---

## Security notes (read these)

- **Never** commit `.env.local`. It's gitignored.
- Only `NEXT_PUBLIC_*` vars reach the browser. Keep secret keys un-prefixed.
- The AI usage cap is enforced server-side in `/api/analyze` *before* the paid call.
- No card data ever touches this app — Stripe handles it all.
- Get a lawyer to review the legal pages before charging. They are templates.

## Where to go next
- Port the full edge-builder, journal, and performance tabs from your v3 prototype
  into the dashboard (the data layer and schema already support them).
- Add the analysis-to-outcome loop (connect chart reads to logged trade results).
- Add shareable verdict cards for organic marketing.
