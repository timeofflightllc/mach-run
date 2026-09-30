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
        src="/brand/mach-run-logo.jpg?v=21"
        alt=""
        width={1257}
        height={428}
        className="mach-run-pulse mach-orbit-logo"
      />
    </div>
  );
}
