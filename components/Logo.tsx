export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-xl bg-primary flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
          <path d="M5 12.5L10 17.5L19 6.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="font-display font-bold text-lg tracking-tight text-navy">
        Agendify
      </span>
    </div>
  );
}
