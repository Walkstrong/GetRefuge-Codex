# GetRefuge

Offline-first crisis intelligence and community response tooling for Malaysia.

GetRefuge helps field teams, community responders, NGOs, and local coordinators
collect ground reports when connectivity is poor, turn scattered public signals
into usable operational intelligence, and generate clear situation summaries for
fast-moving crises.

The core idea is simple: during floods, landslides, outbreaks, outages, or other
community emergencies, people should not have to rely only on stale portals,
WhatsApp rumours, news fragments, or road-app comments to understand what is
happening around them.

## Malaysia Crisis Response Direction

GetRefuge is being refocused from a generic humanitarian Monitoring and
Evaluation prototype into a Malaysia-first crisis response system.

The product is not meant to replace NADMA, JKM, JPS, MetMalaysia, Bomba, local
councils, or other official systems. Those systems remain the authority for
official alerts, evacuation centre records, rainfall, water levels, warnings, and
agency response.

GetRefuge sits below and around those systems as a field and community
intelligence layer:

- Capture structured reports from the ground when internet coverage is weak.
- Combine official feeds, community reports, public posts, news, and volunteer
  updates into one operational view.
- Label reports by freshness, source, location confidence, and verification
  status.
- Cluster duplicate reports so many noisy updates become one actionable
  incident.
- Help coordinators see hazards, access issues, needs, resources, and unresolved
  requests.
- Generate concise BM/English situation reports from aggregated, privacy-aware
  data.

The key product promise is operational clarity under bad connectivity.

## Target Use Cases

GetRefuge is designed for Malaysian community response scenarios such as:

- Floods and flash floods.
- Landslides and slope failures.
- Road closures, fallen trees, broken bridges, submerged routes, and access
  disruption.
- Evacuation centre and temporary shelter status.
- Food, water, medicine, transport, baby supplies, elderly care, OKU support, and
  welfare-check requests.
- Haze, heat, water outages, power outages, telecom disruption, and public health
  support.
- Sabah and Sarawak rural response where reports may be delayed by weak or absent
  network coverage.

The strongest current scenario is an East Malaysia or flood-response workflow:

1. A field worker records household needs, road conditions, photos, GPS, and
   timestamps offline.
2. The app stores reports locally and keeps working without a stable connection.
3. When the device later reaches weak signal, Wi-Fi, or another sync point, queued
   reports are uploaded.
4. The dashboard clusters and maps the updates.
5. Coordinators receive a concise situation summary showing affected households,
   blocked access routes, urgent needs, stale reports, and confidence levels.

## What It Includes

- Calculator-style decoy app entry with PIN unlock.
- Offline-first mobile reporting for incident reports and household/community
  needs assessments.
- Encrypted record storage and sync.
- Optional on-device AI checks that keep the original report unchanged.
- Optional image checks that can flag whether a supporting photo appears to match
  or mismatch the written report.
- Local briefing from recent records stored on the phone.
- HQ dashboard with KPIs, filters, map, charts, record review, and exports.
- AI analyst and SitRep drafting from schema metadata or aggregate summaries.
- Form Studio preview for rapid field forms such as needs checks, shelter
  assessment, and protection/welfare follow-up.

## Planned Malaysia Response Modules

These modules are the next product layer on top of the current GetRefuge
architecture:

- Crisis mode templates for floods, landslides, road access, shelters, supplies,
  medical needs, and welfare checks.
- Freshness labels: live, recent, stale, unknown.
- Confidence labels: verified, corroborated, likely, unverified, disputed.
- Source labels: official feed, trained volunteer, community member, public post,
  news, unknown source.
- Low-bandwidth sync that sends text and coordinates first, thumbnails later, and
  full photos only when requested or on better connectivity.
- Store-and-forward reporting for Sabah, Sarawak, and other low-coverage areas.
- Structured WhatsApp/SMS export fallback for areas where app sync is unavailable.
- Public/community signal ingestion with AI-assisted extraction, geocoding,
  deduplication, and human review.

## Security And Privacy Boundaries

GetRefuge is not production-grade crisis response or humanitarian security
software yet. It implements privacy-preserving architecture patterns, but it has
not been independently audited and should not be used to protect real people in
high-risk environments without significant hardening.

Privacy is not the main pitch for the Malaysia crisis-response direction. The
main pitch is operational clarity when information is fragmented and connectivity
is poor. Privacy still matters because field reports may contain phone numbers,
exact locations, medical needs, children, elderly people, OKU status, migrant or
refugee status, and other sensitive welfare details.

What the current baseline provides:

- Field records are encrypted before sync.
- Supabase and Cloudflare store encrypted records, not report plaintext.
- Mobile AI assistance runs locally on the Android device when configured.
- HQ query planning receives analyst questions and schema metadata, not
  decrypted record bodies.
- SitRep drafting receives aggregate counts, trends, and suppressed small groups,
  not names, record IDs, exact locations, or raw notes.
- Authorized teams can still review full records when they need case-level
  detail.

What it does not claim:

- It does not protect against a compromised phone, browser, laptop, extension,
  operating system, or screen capture.
- It is not a substitute for a formal security audit, deployment threat model, or
  production endpoint controls.
- It is not yet hardened with SQLCipher, hardware-backed keys, managed devices,
  audit logs, step-up authorization, or production RBAC.
- It does not make automated truth claims from social media. AI support should
  triage, extract, cluster, and score confidence while preserving source
  transparency and human review.

## AI Support

**Mobile path**

- Text inference is exposed through a native Android local AI bridge.
- Image checks use the LiteRT-LM Android integration when an image model is
  installed on the device.
- Default local model paths:
  - Text: `/data/local/tmp/llm/local-ai.task`
  - Image: `/data/local/tmp/llm/local-ai-image.litertlm`
- AI checks are advisory. The report save and sync path remains independent of
  AI output.

**HQ path**

- OpenRouter is used for optional dashboard query planning and SitRep drafting.
- Configure `OPENROUTER_API_KEY`.
- Optionally configure `OPENROUTER_MODEL` or comma-separated
  `OPENROUTER_MODEL_IDS`.
- Query planning uses safe schema metadata instead of decrypted record text.
- Situation Reports use aggregate counts, trends, and privacy-filtered summaries.
- Tiny groups are hidden or bucketed before SitRep drafting by default.

Future Malaysia-response AI work should focus on:

- Extracting location, hazard, severity, timestamp, source, and requested help
  from messy reports.
- Deduplicating and clustering many posts about the same incident.
- Scoring freshness and confidence without presenting AI output as confirmed
  truth.
- Producing BM/English coordinator summaries and public-safe updates.

## Tech Stack

**Mobile**

- Expo SDK 52, React Native 0.76.3, Expo Router
- WatermelonDB for offline storage
- TweetNaCl for encryption
- Native Android local AI bridge
- LiteRT-LM Android image checks

**Web dashboard**

- TanStack Start, Vite, React
- TanStack Router, TanStack Query
- Tailwind v4, Recharts, Leaflet
- Browser-side TweetNaCl decryption
- PDF and Excel exports

**Backend**

- Supabase Auth, PostgreSQL, Row-Level Security
- Cloudflare Workers
- OpenRouter for optional HQ AI support

## Repository Structure

```text
getrefuge/
|-- apps/
|   |-- mobile/          # Expo React Native field worker app
|   `-- web/             # TanStack Start HQ dashboard
|-- packages/
|   |-- crypto/          # Shared encryption helpers
|   |-- shared-schema/   # Zod schemas and form types
|   `-- sync/            # Sync protocol logic
`-- supabase/            # Migrations and RLS policies
```

## Run Locally

Requirements:

- Node 20+
- pnpm 10.33.x
- Android device with USB debugging for mobile
- Supabase project
- OpenRouter API key for optional HQ AI support

**Install dependencies**

```bash
pnpm install
```

**Web dashboard**

```bash
cd apps/web
# Configure apps/web/.env with Supabase URL and anon key
# Configure apps/web/.dev.vars with OPENROUTER_API_KEY when using HQ AI
pnpm dev
```

**Mobile app**

```bash
cd apps/mobile
# Configure apps/mobile/.env with Supabase URL and anon key
npx expo run:android
```

For JS iteration after native install:

```bash
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --clear
```

**Supabase**

Apply migrations from `supabase/migrations/` in order. Configure at least one
organization, public key, and user row.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
