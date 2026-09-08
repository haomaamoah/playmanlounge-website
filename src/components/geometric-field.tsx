export function GeometricField({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        className="playman-drift h-[140%] w-[140%] -translate-x-[12%] -translate-y-[10%] opacity-40"
        viewBox="0 0 400 400"
        fill="none"
      >
        <defs>
          <pattern
            id="playman-marks"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M8 8 L16 8 M12 4 L12 12"
              stroke="#F6A21A"
              strokeWidth="1.4"
              opacity="0.55"
            />
            <circle cx="36" cy="12" r="2.2" stroke="#F6A21A" strokeWidth="1.2" />
            <path
              d="M28 32 L36 40 L28 40 Z"
              stroke="#F6A21A"
              strokeWidth="1.1"
              opacity="0.7"
            />
            <path
              d="M6 36 L14 44"
              stroke="#fff"
              strokeWidth="1"
              opacity="0.18"
            />
            <path
              d="M40 28 h6 m-3 -3 v6"
              stroke="#fff"
              strokeWidth="1"
              opacity="0.22"
            />
          </pattern>
        </defs>
        <rect width="400" height="400" fill="url(#playman-marks)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
    </div>
  );
}
