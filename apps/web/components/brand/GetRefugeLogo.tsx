type GetRefugeLogoProps = {
  variant?: 'mark' | 'full'
  className?: string
}

export function GetRefugeLogo({
  variant = 'full',
  className = '',
}: GetRefugeLogoProps) {
  const mark = (
    <svg
      style={{ width: '2rem', height: '2rem', flex: 'none' }}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 4.75 38.25 10.25V21.9C38.25 31.3 32.55 38.15 24 43.25 15.45 38.15 9.75 31.3 9.75 21.9V10.25L24 4.75Z"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M16.25 25.35 24 17.8l7.75 7.55"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.1 24.8V33h9.8v-8.2"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 16.35c3.55-2.05 6.75-2.05 9.65-.05 2.4 1.65 4.7 1.9 7.35.6"
        stroke="var(--accent, currentColor)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1.6 4"
      />
      <circle cx="15.5" cy="16.35" r="1.7" fill="var(--accent, currentColor)" />
      <circle cx="32.5" cy="16.9" r="1.7" fill="var(--accent, currentColor)" />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span
        aria-label="GetRefuge"
        role="img"
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', color: 'currentColor' }}
      >
        {mark}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.625rem',
        color: 'currentColor',
      }}
    >
      {mark}
      <span
        style={{
          fontFamily:
            "var(--serif, ui-serif, Georgia, 'Times New Roman', serif)",
          fontSize: '1.125rem',
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        GetRefuge
      </span>
    </span>
  )
}
