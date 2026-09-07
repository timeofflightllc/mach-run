import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { BrandLockup, MachFooter } from "@/components/meridian/mach-mark";
import { SiteCopyBody } from "@/components/meridian/site-copy-view";
import { SiteNav } from "@/components/meridian/site-nav";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ContactTopic } from "@/lib/notify/contact";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";

export const Route = createFileRoute("/contact")({
  loader: () => loadPublicSiteCopy(),
  component: Contact,
});

const TOPICS: { id: ContactTopic; label: string }[] = [
  { id: "general", label: "General Question" },
  { id: "bug", label: "Report a Bug" },
  { id: "feature", label: "Feature Request" },
];

function Contact() {
  const copy = Route.useLoaderData();
  const page = pageBySlug(copy, "contact");
  const [topic, setTopic] = useState<ContactTopic>("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint =
    topic === "bug"
      ? "What did you expect, what happened, and which page were you on?"
      : topic === "feature"
        ? "What should MACH RUN do that it does not do yet?"
        : "Ask anything about the calculator, billing, or your account.";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, name, email, message, company }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.reason || "Could not send. Try again in a minute.");
      }
      setDone(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <Link to="/" className="inline-block opacity-90 hover:opacity-100">
          <BrandLockup framed />
        </Link>
        <SiteNav />
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            machrun.com
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">{page.title}</h1>
          {page.kicker ? <p className="mt-2 text-sm text-muted">{page.kicker}</p> : null}
        </header>
        {page.body.trim() ? <SiteCopyBody body={page.body} /> : null}

        <div className="flex justify-center">
          <div className="inline-flex max-w-full flex-wrap justify-center rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--color-border)]">
            {TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={topic === item.id}
                onClick={() => setTopic(item.id)}
                className={cn(
                  "h-11 rounded-md px-3 text-sm font-medium sm:px-4",
                  topic === item.id
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <p className="text-sm text-muted">{hint}</p>
          <Field label="Name">
            <TextInput
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            <input
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <Field label="Message">
            <textarea
              required
              minLength={10}
              maxLength={4000}
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]"
            />
          </Field>
          {error ? <p className="text-sm text-negative">{error}</p> : null}
          {done ? (
            <p className="text-sm text-positive">
              Sent. If it needs a reply, it will come back to {email || "your inbox"}.
            </p>
          ) : null}
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </PrimaryButton>
        </form>
      </div>
      <MachFooter />
    </main>
  );
}
