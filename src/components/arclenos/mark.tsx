export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" fill="var(--color-background)" />
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="miter">
        <circle cx="16" cy="16" r="8" />
        <path d="M10.2 22.6 L21.8 9.4" />
      </g>
    </svg>
  );
}
