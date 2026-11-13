import type { CSSProperties, ReactNode } from "react";

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500&display=swap";

/** Crash and missing pages. Inline so they stay on-brand if the app CSS never arrives. */
export function FaultPage({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f3f0e8",
        color: "#1e2a32",
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`html,body{margin:0;background:#f3f0e8;}`}</style>
      <header>
        <div style={{ display: "flex", justifyContent: "center", background: "#ffffff", padding: "12px 16px 0" }}>
          <img
            src="/brand/mach-run-logo-quiz.png"
            alt="MACH RUN"
            style={{ height: "4.25rem", width: "auto" }}
          />
        </div>
        <p
          style={{
            margin: 0,
            background: "#1a2330",
            color: "#d7dde4",
            textAlign: "center",
            fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
            fontWeight: 700,
            letterSpacing: "0.14em",
            fontSize: "0.95rem",
            lineHeight: 1.3,
            padding: "0.7rem 1rem 0.85rem",
          }}
        >
          THE SUPERSONIC RETIREMENT CALCULATOR
        </p>
      </header>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.75rem 1.25rem",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "26rem",
            background: "#fffcf6",
            border: "1px solid #d5d0c6",
            borderRadius: "16px",
            boxShadow: "0 10px 28px rgba(26, 35, 48, 0.06)",
            padding: "2.25rem 1.75rem 1.85rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 0.65rem",
              color: "#3a8a58",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {kicker}
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
              fontWeight: 600,
              fontSize: "2.35rem",
              lineHeight: 1.05,
              letterSpacing: "0.01em",
              color: "#1e2a32",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: "0.85rem auto 0",
              maxWidth: "22rem",
              color: "#3d4a54",
              fontSize: "0.98rem",
              lineHeight: 1.55,
            }}
          >
            {body}
          </p>
          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
            {children}
          </div>
        </section>
      </div>
      <footer style={{ textAlign: "center", padding: "0 1rem 1.35rem", color: "#5d6c78", fontSize: "11px", lineHeight: 1.45 }}>
        <p style={{ margin: 0 }}>© 2026 Mach Run</p>
        <p style={{ margin: "0.15rem 0 0" }}>Operated by Time of Flight LLC.</p>
      </footer>
    </div>
  );
}

export function faultButtonStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "2.75rem",
    padding: "0 1.35rem",
    border: 0,
    borderRadius: "8px",
    background: "#3a8a58",
    color: "#fff8f4",
    fontFamily: "inherit",
    fontSize: "0.95rem",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
  };
}


