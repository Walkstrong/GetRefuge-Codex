# GetRefuge

Offline-first crisis intelligence and community response tooling for Malaysia.

GetRefuge is a Malaysia-first project for turning scattered crisis signals into
a clear, confidence-scored view of what is happening, what help is needed, and
which reports are still uncertain.

The goal is not to replace official systems such as NADMA, JKM, JPS,
METMalaysia, Bomba, local councils, myCuaca, RakanMET, Public InfoBanjir, Portal
Bencana, or MyDIMS. Those systems remain the authority for official alerts,
forecasts, agency records, and emergency response.

GetRefuge complements them with an operations layer for communities, NGOs,
volunteers, and local coordinators.

## Problem

During Malaysian crises, people often rely on fragmented sources:

- official portals and agency apps,
- WhatsApp and Telegram groups,
- social media posts,
- news updates,
- road-app comments,
- local volunteer reports,
- word of mouth from nearby communities.

Those sources can be stale, duplicated, noisy, hard to verify, or unavailable in
low-coverage areas. In places such as Sabah and Sarawak, reports from affected
communities may also be delayed because internet coverage is weak or absent.

The practical problem is not just lack of information. It is lack of clear,
fresh, trusted, actionable information.

## Solution

GetRefuge helps responders and communities collect, structure, and interpret
crisis information even when connectivity is poor.

A working demo should show:

- offline field reporting for hazards, blocked routes, shelter status, and aid
  requests,
- low-bandwidth sync when a device regains signal,
- a map and incident feed with freshness and confidence labels,
- community and field reports alongside relevant official/public signals,
- duplicate report clustering,
- BM/English situation summaries for coordinators,
- exports for NGOs, campus responders, local groups, or volunteer teams.

The key product promise is:

> Operational clarity under bad connectivity.

## Target Users

GetRefuge is designed for:

- Malaysians affected by floods, landslides, outages, road disruptions, public
  health crises, and community emergencies,
- rural and low-coverage communities in Sabah, Sarawak, and other underserved
  areas,
- local NGOs and volunteer groups,
- community leaders and local coordinators,
- campus response teams,
- CSR and corporate relief teams,
- groups supporting B40 households, elderly people, OKU communities, and other
  vulnerable residents.

## Target Use Cases

Initial Malaysia-focused crisis workflows:

- flood and flash-flood reports,
- landslide and slope-failure reports,
- blocked roads, fallen trees, broken bridges, submerged routes, and access
  disruption,
- evacuation centre and temporary shelter status,
- food, water, medicine, transport, baby supplies, elderly care, OKU support, and
  welfare-check requests,
- haze, heat, water outages, power outages, telecom disruption, and public health
  support,
- store-and-forward reporting from rural or low-coverage communities.

## Differentiation

Malaysia already has official and public disaster apps. GetRefuge should not be
another alert portal.

GetRefuge differentiates by focusing on:

- **offline-first field capture**: reports can be created before stable internet
  exists,
- **community ground truth**: field workers and local responders can capture what
  is happening before it reaches official systems,
- **freshness and confidence**: reports are marked as recent, stale, verified,
  corroborated, unverified, or disputed,
- **needs coordination**: responders can see who needs food, water, medicine,
  transport, shelter, or welfare checks,
- **low-bandwidth operation**: text and coordinates can sync first, with images
  deferred until better connectivity,
- **clean crisis UX**: a decision-first map, feed, and coordinator dashboard
  instead of cluttered status pages,
- **AI-assisted triage**: AI extracts locations, hazards, timestamps, requests,
  and duplicate reports while keeping human review and source transparency.

## Responsible AI

GetRefuge should not claim that AI determines truth during a crisis.

AI support should help with:

- extracting location, hazard, severity, timestamp, source, and requested help
  from messy reports,
- clustering duplicate public or field reports,
- comparing reports against nearby official or community signals,
- scoring freshness and confidence,
- generating BM/English coordinator summaries.

High-impact or uncertain reports should stay reviewable by humans. The system
should show why a report is considered verified, corroborated, unverified,
stale, or disputed.

## Current Prototype

The existing GetRefuge codebase already includes pieces that can support this
pivot:

- offline-first mobile reporting,
- encrypted record storage and sync,
- incident and household/community assessment flows,
- optional on-device AI checks,
- image support,
- local briefings from records stored on the phone,
- HQ dashboard with KPIs, filters, maps, charts, record review, and exports,
- aggregate SitRep drafting from privacy-aware summaries,
- Form Studio preview for rapid field forms.

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
