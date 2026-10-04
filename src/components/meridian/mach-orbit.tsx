/** Pulsing MACH RUN mark. A sketch fighter flies a clockwise positive-G turn, canopy toward the logo. */
export function MachOrbit() {
  return (
    <div className="mach-orbit">
      <div className="mach-orbit-ring" aria-hidden />
      <div className="mach-comet" aria-hidden>
        <div className="mach-contrail-wash" />
        <svg className="mach-contrail" viewBox="0 0 100 100">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M13.44 82.92 A49.2 49.2 0 0 1 1.55 58.54" strokeWidth="1.7" opacity="0.1" />
            <path d="M1.55 58.54 A49.2 49.2 0 0 1 4.38 31.57" strokeWidth="1.45" opacity="0.18" />
            <path d="M4.38 31.57 A49.2 49.2 0 0 1 18.37 12.31" strokeWidth="1.2" opacity="0.3" />
            <path d="M18.37 12.31 A49.2 49.2 0 0 1 36.44 2.71" strokeWidth="1.05" opacity="0.5" />
            <path d="M15.52 81.05 A46.4 46.4 0 0 1 4.30 58.06" strokeWidth="1.5" opacity="0.08" />
            <path d="M4.30 58.06 A46.4 46.4 0 0 1 6.98 32.62" strokeWidth="1.25" opacity="0.16" />
            <path d="M6.98 32.62 A46.4 46.4 0 0 1 20.17 14.46" strokeWidth="1.05" opacity="0.28" />
            <path d="M20.17 14.46 A46.4 46.4 0 0 1 37.21 5.40" strokeWidth="0.9" opacity="0.46" />
          </g>
        </svg>
        <svg className="mach-jet" viewBox="-150 -36 240 72">
          {/* Flip so the canopy side (negative y in the sketch) faces the logo. Nose stays +x, clockwise. */}
          <g transform="scale(1 -1)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-46 1.5C-16-2 22-3 48 0.5c8 1 16 2.2 22 3-8 1.2-18 2.4-28 2.6C8 7.2-22 6-46 2.4" strokeWidth="2.15" />
            <path d="M7-1.67c3-6.5 12-8.5 20 0.38" strokeWidth="1.9" />
            <path d="M16 5L-1 22L-12 25L-2 6.2Z" strokeWidth="2" />
            <path d="M-30-0.5L-40-16L-22 0.5" strokeWidth="2" />
            <path d="M-24 0.4L-32-13L-16 1.2" strokeWidth="1.7" />
            <path d="M-34 2.5L-50 11L-28 4" strokeWidth="1.85" />
            <path d="M13-1.66L0-8.6L-16-9.2L-8-1.36Z" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
      <img
        src="/brand/mach-run-logo.jpg?v=23"
        alt=""
        width={887}
        height={271}
        className="mach-run-pulse mach-orbit-logo"
      />
    </div>
  );
}