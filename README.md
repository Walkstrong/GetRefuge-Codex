# GetRefuge

Secure Monitoring and Evaluation for high-risk humanitarian field work.

GetRefuge helps field teams collect sensitive reports in restricted,
low-connectivity, or high-risk environments. A field worker can capture incident
reports, beneficiary interviews, photos, and protection concerns offline; each
record is encrypted before sync, and authorized HQ teams decrypt records only in
the browser with the organization passphrase.

The core idea is simple: useful coordination and AI support should not require
pasting sensitive humanitarian notes into a cloud chatbot.

## What It Includes

- Calculator-style decoy app entry with PIN unlock.
- Offline-first mobile reporting for incident reports and beneficiary interviews.
- Encrypted record storage and sync.
- Optional on-device AI checks that keep the original report unchanged.
- Optional image checks that can flag whether a supporting photo appears to match
  or mismatch the written report.
- Local briefing from recent records stored on the phone.
- HQ dashboard with KPIs, filters, map, charts, record review, and exports.
- AI analyst and SitRep drafting from schema metadata or aggregate summaries.

## Security And Privacy Boundaries

GetRefuge is not production-grade humanitarian security software yet. It
implements privacy-preserving architecture patterns, but it has not been
independently audited and should not be used to protect real people in high-risk
environments without significant hardening.

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
