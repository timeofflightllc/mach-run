/** Pulsing MACH RUN mark with a clockwise comet. One lap is slow; the glow matches the logo pulse. */
export function MachOrbit() {
  return (
    <div className="mach-orbit">
      <div className="mach-orbit-ring" aria-hidden />
      <div className="mach-comet" aria-hidden>
        <div className="mach-comet-arc" />
        <span className="mach-comet-head" />
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
