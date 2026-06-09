import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  KeyRound,
  Lock,
  MapPinned,
  MessageSquare,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { GetRefugeLogo } from '../brand/GetRefugeLogo'

const pillars = [
  {
    icon: Smartphone,
    title: 'Offline field capture',
    body: 'Workers can record incidents, interviews, photos, and follow-up needs when connectivity is weak or unsafe.',
  },
  {
    icon: Lock,
    title: 'Client-side encryption',
    body: 'Records are encrypted before sync. HQ teams decrypt in the browser with the organization passphrase.',
  },
  {
    icon: MessageSquare,
    title: 'Local AI assistance',
    body: 'On-device checks can review a report, compare an attached image, and prepare a short local briefing.',
  },
  {
    icon: BarChart3,
    title: 'Safer HQ analysis',
    body: 'Coordinators can filter, aggregate, export, and draft situation reports from privacy-aware summaries.',
  },
]

const boundaries = [
  'GetRefuge is not a replacement for a deployment threat model or formal security audit.',
  'Client devices, browsers, extensions, operating systems, and screenshots remain part of the risk surface.',
  'Production deployments should add managed devices, audit logging, hardened key storage, and mature role controls.',
]

const workflow = [
  {
    step: '01',
    title: 'Collect',
    body: 'A field worker records structured reports and photos in the mobile app.',
  },
  {
    step: '02',
    title: 'Encrypt',
    body: 'The app encrypts each payload before queueing it for sync.',
  },
  {
    step: '03',
    title: 'Sync',
    body: 'Encrypted records move to Supabase when a safe connection is available.',
  },
  {
    step: '04',
    title: 'Analyze',
    body: 'Authorized HQ users decrypt records locally and work from dashboards, exports, and aggregate AI briefs.',
  },
]

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#10231e]">
      <header className="sticky top-0 z-20 border-b border-[#c8d6cf] bg-[#f4f7f5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3" aria-label="GetRefuge home">
            <GetRefugeLogo variant="mark" />
            <span className="text-sm font-semibold tracking-[0.18em] text-[#45635a]">
              GETREFUGE
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#45635a] md:flex">
            <a href="#workflow" className="hover:text-[#10231e]">Workflow</a>
            <a href="#privacy" className="hover:text-[#10231e]">Privacy</a>
            <a href="#stack" className="hover:text-[#10231e]">Stack</a>
          </nav>
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-sm bg-[#1d5f55] px-4 text-sm font-semibold text-white hover:bg-[#15483f]"
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pb-20 lg:pt-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b54c3b]">
            Secure humanitarian monitoring
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-[#10231e] sm:text-6xl lg:text-7xl">
            Private field data, usable when the network is not.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4c625a]">
            GetRefuge helps humanitarian teams collect sensitive reports offline,
            encrypt records before sync, and review field patterns without turning
            every private note into an AI prompt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex h-11 items-center rounded-sm bg-[#1d5f55] px-5 text-sm font-semibold text-white hover:bg-[#15483f]"
            >
              Open Dashboard
            </Link>
            <a
              href="#workflow"
              className="inline-flex h-11 items-center rounded-sm border border-[#9eb3aa] px-5 text-sm font-semibold text-[#10231e] hover:border-[#1d5f55]"
            >
              View Workflow
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-[#c8d6cf] bg-white shadow-[0_18px_50px_-34px_rgba(19,51,44,0.5)]">
          <div className="relative aspect-[4/3]">
            <img
              src="/landing/map.jpg"
              alt="Regional operational map"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 border-t border-white/35 bg-[#10231e]/88 p-5 text-white">
              <div className="flex items-start gap-3">
                <MapPinned className="mt-1 h-5 w-5 text-[#8bd3c7]" />
                <div>
                  <p className="text-sm font-semibold">Operational picture</p>
                  <p className="mt-1 text-sm leading-6 text-white/78">
                    Dashboard views are built from decrypted records in the browser,
                    with aggregate AI drafting kept behind a clear privacy boundary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#c8d6cf] bg-white">
        <div className="mx-auto grid max-w-7xl gap-px px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="border border-[#d8e3dd] bg-[#fbfcfb] p-5">
                <Icon className="h-6 w-6 text-[#1d5f55]" />
                <h2 className="mt-5 text-lg font-semibold text-[#10231e]">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#526860]">{item.body}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b54c3b]">
            Field to HQ
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal text-[#10231e] sm:text-4xl">
            Built for teams that need both discretion and coordination.
          </h2>
        </div>
        <div className="mt-9 grid gap-4 lg:grid-cols-4">
          {workflow.map((item) => (
            <article key={item.step} className="border-l-2 border-[#1d5f55] bg-white p-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#789088]">{item.step}</p>
              <h3 className="mt-5 text-xl font-semibold text-[#10231e]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#526860]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" className="bg-[#10231e] px-5 py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-sm bg-[#1d5f55]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-normal sm:text-4xl">
              Privacy boundary first, AI second.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/72">
              The product starts from encrypted collection and explicit access
              control. AI support is optional and works from local context or
              privacy-filtered aggregate summaries.
            </p>
          </div>
          <div className="grid gap-3">
            {boundaries.map((item) => (
              <div key={item} className="flex gap-3 border border-white/12 bg-white/5 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#f1b65c]" />
                <p className="text-sm leading-6 text-white/78">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stack" className="mx-auto grid max-w-7xl gap-6 px-5 py-16 lg:grid-cols-3">
        <StackBlock
          icon={<Smartphone className="h-5 w-5" />}
          title="Mobile"
          items={['Expo React Native', 'WatermelonDB offline storage', 'Native local AI bridge', 'Encrypted sync queue']}
        />
        <StackBlock
          icon={<ClipboardList className="h-5 w-5" />}
          title="Web"
          items={['TanStack Start', 'Browser-side decryption', 'Recharts and Leaflet views', 'PDF and workbook exports']}
        />
        <StackBlock
          icon={<KeyRound className="h-5 w-5" />}
          title="Backend"
          items={['Supabase Auth and PostgreSQL', 'Row-Level Security', 'Cloudflare Worker deployment', 'OpenRouter for optional HQ AI']}
        />
      </section>
    </main>
  )
}

function StackBlock({
  icon,
  title,
  items,
}: {
  icon: ReactNode
  title: string
  items: string[]
}) {
  return (
    <article className="border border-[#d8e3dd] bg-white p-6">
      <div className="flex items-center gap-3 text-[#1d5f55]">
        {icon}
        <h2 className="text-xl font-semibold text-[#10231e]">{title}</h2>
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-[#526860]">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#b54c3b]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
