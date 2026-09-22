export function MapCard({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-sage-3 ring-1 ring-line">
      <svg viewBox="0 0 320 140" className="h-32 w-full" aria-hidden>
        <rect width="320" height="140" fill="#e7f1ea" />
        <path d="M0 88h320" stroke="#d2e3d8" strokeWidth="18" />
        <path d="M40 0v140" stroke="#dbeadf" strokeWidth="14" />
        <path d="M210 0v140" stroke="#dbeadf" strokeWidth="10" />
        <rect x="24" y="18" width="70" height="46" rx="8" fill="#cfe0d4" />
        <rect x="118" y="28" width="86" height="58" rx="10" fill="#b9d2c2" />
        <rect x="228" y="16" width="64" height="40" rx="8" fill="#cfe0d4" />
        <circle cx="168" cy="58" r="22" fill="#9fbfad" />
        <circle cx="168" cy="58" r="8" fill="#154734" />
        <path d="M168 34c-14 18-14 30 0 48 14-18 14-30 0-48z" fill="#154734" />
        <circle cx="168" cy="42" r="7" fill="#FAF8F3" />
      </svg>
      <p className="absolute bottom-2 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-forest shadow-soft">
        {label}
      </p>
    </div>
  );
}
