import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { TurnstileBox, turnstileEnabled } from "@/components/auth/turnstile-box";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import { submitReview } from "@/lib/notify/review-api";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

const MAX = 250;

export const Route = createFileRoute("/review")({
  head: () =>
    pageHead({
      title: "Submit a Review | MACH RUN",
      description: "A short review of MACH RUN. 250 characters. It is read before it is used.",
      path: "/review",
    }),
  component: ReviewPage,
});

function ReviewPage() {
  const [name, setName] = useState("");
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [company, setCompany] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsCaptcha = turnstileEnabled();
  const ready = name.trim().length >= 2 && stars >= 1 && review.trim().length >= 10 && review.trim().length <= MAX && (!needsCaptcha || Boolean(captcha));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitReview({
        data: { name, stars, review, captcha: captcha ?? "", company },
      });
      if (!result.ok) {
        setError(result.reason);
        setCaptcha(null);
        setCaptchaReset((n) => n + 1);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full max-w-xl space-y-8">
        <PageMast />
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to="/" className="underline underline-offset-4 hover:text-fg">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-fg">Submit a Review</span>
        </nav>
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">Submit a Review</h1>
          <p className="mt-2 text-lg text-muted">250 characters. MACH RUN reads it before it is used anywhere.</p>
        </header>
        {done ? (
          <p className="text-base text-fg">Received. Thank you. This review is not on the site until MACH RUN uses it.</p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-fg">Stars</p>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    onClick={() => setStars(n)}
                    className="rounded-md p-1 text-fg hover:bg-surface"
                  >
                    <Star className={cn("size-7", n <= stars ? "fill-current" : "")} strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            </div>
            <Field label="Name">
              <TextInput required autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Short review">
              <textarea
                required
                maxLength={MAX}
                rows={5}
                value={review}
                onChange={(e) => setReview(e.target.value.slice(0, MAX))}
                className="w-full min-w-0 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]"
              />
              <p className="mt-1 text-xs text-subtle">{review.trim().length} of {MAX}</p>
            </Field>
            <div className="hidden" aria-hidden>
              <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <TurnstileBox resetKey={captchaReset} onToken={setCaptcha} />
            {error ? <p className="text-sm text-negative">{error}</p> : null}
            <PrimaryButton type="submit" disabled={!ready || busy}>
              {busy ? "Sending…" : "Submit a Review"}
            </PrimaryButton>
          </form>
        )}
      </div>
      <MachFooter staticInset />
    </main>
  );
}
