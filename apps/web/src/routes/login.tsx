import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { GetRefugeLogo } from '../../components/brand/GetRefugeLogo'
import { supabase } from '../../lib/supabase'

const STORAGE_KEY = 'getrefuge-landing-theme'

const LIGHT = {
  '--page-bg': '#EAF2F6',
  '--page-band': '#DCEAF0',
  '--surface': '#FBFDFF',
  '--surface-soft': '#EEF6FA',
  '--surface-strong': '#D2E2EA',
  '--border': '#9CB6C1',
  '--border-strong': '#315F6E',
  '--text': '#0B2530',
  '--muted': '#506A76',
  '--primary': '#236E7B',
  '--primary-strong': '#155B68',
  '--primary-contrast': '#FFFFFF',
  '--accent': '#C94E3D',
  '--shadow': '0 1px 0 rgba(20,63,83,0.08), 0 24px 60px -32px rgba(20,63,83,0.28)',
} as CSSProperties

const DARK = {
  '--page-bg': '#0B1A1E',
  '--page-band': '#0F2428',
  '--surface': '#142A2E',
  '--surface-soft': '#1A3338',
  '--surface-strong': '#244A50',
  '--border': '#2D535C',
  '--border-strong': '#7CB5BD',
  '--text': '#EDF8F7',
  '--muted': '#A9C2C7',
  '--primary': '#8BD7D0',
  '--primary-strong': '#B7EEE8',
  '--primary-contrast': '#082024',
  '--accent': '#F06D56',
  '--shadow': '0 1px 0 rgba(255,255,255,0.04), 0 24px 60px -32px rgba(0,0,0,0.58)',
} as CSSProperties

const LOGIN_CSS = `
  [data-theme] {
    --serif: ui-serif, 'Iowan Old Style', 'Apple Garamond', 'Source Serif 4', 'Source Serif Pro', Cambria, Constantia, Georgia, 'Times New Roman', serif;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, 'Courier New', monospace;
    font-feature-settings: 'kern', 'liga', 'calt';
  }

  @keyframes gr-login-hotspot-pulse {
    0%, 100% {
      opacity: 0.42;
      transform: translate(-50%, -50%) scale(0.9);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.5),
        0 0 0 5px rgba(201, 78, 61, 0.14),
        0 0 18px rgba(201, 78, 61, 0.18);
    }
    46% {
      opacity: 0.82;
      transform: translate(-50%, -50%) scale(1.08);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.68),
        0 0 0 10px rgba(201, 78, 61, 0.2),
        0 0 26px rgba(201, 78, 61, 0.28);
    }
  }

  .gr-login-map {
    background-image: url('/landing/map.jpg');
    background-size: 1120px auto;
    background-position: right -140px top -90px;
    background-repeat: no-repeat;
    opacity: 0.24;
  }

  [data-theme='dark'] .gr-login-map {
    opacity: 0.18;
    filter: brightness(0.55) saturate(0.82) contrast(1.05);
  }

  .gr-login-hotspot {
    position: absolute;
    border-radius: 999px;
    background: var(--accent);
    transform: translate(-50%, -50%);
    animation: gr-login-hotspot-pulse 4200ms ease-in-out infinite;
  }

  .gr-login-hotspot::after {
    content: '';
    position: absolute;
    inset: 34%;
    border-radius: inherit;
    background: color-mix(in srgb, white 68%, var(--accent));
  }

  @media (prefers-reduced-motion: reduce) {
    .gr-login-hotspot {
      animation: none;
      opacity: 0.58;
      transform: translate(-50%, -50%);
    }
  }

  .gr-login-eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 500;
  }

  .gr-login-serif {
    font-family: var(--serif);
    letter-spacing: -0.025em;
  }
`

const LOGIN_HOTSPOTS = [
  { x: 50, y: 22, size: 7, delay: 0 },
  { x: 62, y: 18, size: 8, delay: 460 },
  { x: 72, y: 27, size: 7, delay: 920 },
  { x: 82, y: 21, size: 8, delay: 1380 },
  { x: 57, y: 39, size: 7, delay: 1840 },
  { x: 69, y: 45, size: 8, delay: 2300 },
  { x: 80, y: 52, size: 7, delay: 2760 },
  { x: 60, y: 67, size: 8, delay: 3220 },
  { x: 73, y: 73, size: 7, delay: 3680 },
  { x: 86, y: 80, size: 8, delay: 4140 },
] as const

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'GetRefuge | Sign in' },
      {
        name: 'description',
        content:
          'Sign in to the GetRefuge HQ dashboard for secure humanitarian Monitoring and Evaluation.',
      },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  async function handleLogin() {
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    setLoading(true)
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })
      if (authError || !authData.user) {
        setError(authError?.message || 'Login failed')
        return
      }
      navigate({ to: '/dashboard' })
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const themeVars = theme === 'dark' ? DARK : LIGHT

  return (
    <div
      data-theme={theme}
      className="relative min-h-screen overflow-hidden"
      style={{
        ...themeVars,
        background: 'var(--page-bg)',
        color: 'var(--text)',
      }}
    >
      <style>{LOGIN_CSS}</style>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="gr-login-map absolute inset-0" />
        {LOGIN_HOTSPOTS.map((hotspot, index) => (
          <span
            key={`${hotspot.x}-${hotspot.y}-${index}`}
            className="gr-login-hotspot"
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.size}px`,
              height: `${hotspot.size}px`,
              animationDelay: `${hotspot.delay}ms`,
            }}
          />
        ))}
      </div>

      <header className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link to="/" style={{ color: 'var(--text)' }}>
          <GetRefugeLogo />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="inline-flex h-9 w-9 items-center justify-center"
          style={{ color: 'var(--muted)', background: 'transparent' }}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-12 px-5 py-12 sm:px-6 lg:grid-cols-[0.95fr_0.72fr] lg:px-8">
        <section className="hidden lg:block">
          <p className="gr-login-eyebrow" style={{ color: 'var(--accent)' }}>
            HQ access
          </p>
          <h1
            className="gr-login-serif mt-6 max-w-[13ch] text-[4rem] font-normal leading-[1.02]"
            style={{ color: 'var(--text)' }}
          >
            Protected access for humanitarian teams.
          </h1>
          <p
            className="mt-8 max-w-[58ch] text-[1.05rem] leading-[1.65]"
            style={{ color: 'var(--muted)' }}
          >
            Sign in to unlock encrypted field data, review operational pressure,
            and turn protected trends into decisions.
          </p>
        </section>

        <section
          className="border p-6 sm:p-8"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="mb-8">
            <div style={{ color: 'var(--text)' }}>
              <GetRefugeLogo variant="mark" />
            </div>
            <p
              className="gr-login-eyebrow mt-6"
              style={{ color: 'var(--accent)' }}
            >
              Secure dashboard
            </p>
            <h2
              className="gr-login-serif mt-3 text-3xl font-normal leading-tight sm:text-4xl"
              style={{ color: 'var(--text)' }}
            >
              Sign in to GetRefuge.
            </h2>
            <p
              className="mt-3 text-sm leading-6"
              style={{ color: 'var(--muted)' }}
            >
              Use an account configured for this environment, or contact your
              organization administrator.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleLogin()
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="gr-login-eyebrow block"
                style={{ color: 'var(--muted)' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border px-4 py-3 text-sm outline-none"
                style={{
                  background: 'var(--page-bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="gr-login-eyebrow block"
                style={{ color: 'var(--muted)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border px-4 py-3 text-sm outline-none"
                style={{
                  background: 'var(--page-bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
                autoComplete="current-password"
              />
            </div>
            {error ? (
              <p className="text-sm leading-6" style={{ color: 'var(--accent)' }}>
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center px-4 text-sm font-medium disabled:opacity-50"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-contrast)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
