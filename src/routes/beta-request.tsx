import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { TurnstileBox, turnstileEnabled } from "@/components/auth/turnstile-box";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { RedirectToSignIn, isRealUser } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/beta-request")({
  head: () =>
    pageHead({
      title: "Beta tester request | MACH RUN",
      description: "Ask to become a MACH RUN beta tester.",
      path: "/beta-request",
      noindex: true,
    }),
  component: BetaRequestPage,
});

function BetaRequestPage() {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isRealUser(user) || seeded) return;
    setName(user.displayName ?? "");
    setEmail(user.primaryEmail ?? "");
    setSeeded(true);
  }, [user, seeded]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/beta-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, note, company, captcha: captcha ?? "" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (!res.ok || !data?.ok) {
        setCaptcha(null);
        setCaptchaReset((n) => n + 1);
        throw new Error(data?.reason || "Could not send. Try again in a minute.");
      }
      setNote("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  const needsCaptcha = turnstileEnabled();

  if (isPending && !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg text-muted">
        Loading…
      </main>
    );
  }
  if (!isPending && !isRealUser(user)) return <RedirectToSignIn />;

  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">Beta tester request</h1>
          <p className="mt-2 text-lg text-muted">
            Submit your request to become a MACH RUN Beta Tester. We need fighter pilot-minded teammates to make MACH RUN the top retirement planning tool for military, military families and beyond. This request goes straight to Cain - thank you!
          </p>
        </header>
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <Field label="Name">
            <TextInput required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div className="hidden" aria-hidden>
            <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <Field label="Note">
            <textarea
              required
              minLength={10}
              maxLength={4000}
              rows={8}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]"
            />
          </Field>
          <TurnstileBox resetKey={captchaReset} onToken={setCaptcha} />
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          {done ? <p className="text-sm text-positive">Sent. Cain will write you back.</p> : null}
          <PrimaryButton type="submit" disabled={busy || (needsCaptcha && !captcha)}>
            {busy ? "Sending…" : "Send request"}
          </PrimaryButton>
        </form>
      </div>
      <MachFooter staticInset />
    </main>
  );
}
