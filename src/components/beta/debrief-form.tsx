import { useRef, useState } from "react";
import { BETA_BROWSERS, BETA_DEVICE_KINDS, BETA_OS, BETA_PLANS, BETA_SECTIONS, betaBrowserLabel, betaDeviceLine, betaOsLabel, betaPlanLabel, type BetaAnswers, type BetaDeviceKind, type BetaPlan, type BetaSectionKey } from "@/lib/beta/form";
import { GhostButton, PrimaryButton, TextArea, TextInput } from "@/components/ui/field";

const wide = "w-full min-w-0 max-w-none";
const selectClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 text-sm text-fg outline-none disabled:opacity-50";

const STEPS = [
  { id: "intro", label: "Beta Tester Information" },
  { id: "family", label: "Observe — Family / Assumptions" },
  { id: "assets", label: "Observe — Assets / Liabilities" },
  { id: "income", label: "Orient — Income / Spending" },
  { id: "goals", label: "Decide — Goals" },
  { id: "contributions", label: "Decide — Contributions" },
  { id: "takeoff", label: "Act — Takeoff and Analysis" },
  { id: "charts", label: "Act — Charts and Ledgers" },
  { id: "overall", label: "Overall" },
  { id: "hat", label: "Thank-you gift" },
] as const;

export function DebriefForm({
  answers,
  email,
  readOnly = false,
  addressOnFile = false,
  onChange,
  busy = null,
  onDraft,
  onSubmit,
}: {
  answers: BetaAnswers;
  email: string;
  readOnly?: boolean;
  addressOnFile?: boolean;
  onChange?: (next: BetaAnswers) => void;
  busy?: "draft" | "submit" | null;
  onDraft?: () => void;
  onSubmit?: () => void;
}) {
  const [step, setStep] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const current = STEPS[step] ?? STEPS[0];
  const last = step === STEPS.length - 1;

  function patch(next: Partial<BetaAnswers>) {
    if (readOnly || !onChange) return;
    onChange({ ...answers, ...next });
  }

  function patchSection(key: BetaSectionKey, next: Partial<BetaAnswers["sections"][BetaSectionKey]>) {
    if (readOnly || !onChange) return;
    onChange({
      ...answers,
      sections: { ...answers.sections, [key]: { ...answers.sections[key], ...next } },
    });
  }

  function patchHat(next: Partial<BetaAnswers["hat"]>) {
    if (readOnly || !onChange) return;
    onChange({ ...answers, hat: { ...answers.hat, ...next } });
  }

  function go(index: number) {
    const next = Math.min(STEPS.length - 1, Math.max(0, index));
    setStep(next);
    window.requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const section = BETA_SECTIONS.find((row) => row.key === current.id);

  return (
    <div className="space-y-8">
      <div ref={top} className="scroll-mt-6 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
            Step {step + 1} of {STEPS.length}
          </p>
          <p className="text-right text-sm font-medium text-fg">{current.label}</p>
        </div>
        <div className="h-2 w-full bg-elevated" aria-hidden>
          <div className="h-full bg-fg" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Debrief steps">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === step}
              aria-label={`${index + 1}. ${item.label}`}
              onClick={() => go(index)}
              className={
                index === step
                  ? "inline-flex size-9 items-center justify-center bg-fg text-sm font-medium text-bg"
                  : "inline-flex size-9 items-center justify-center bg-elevated text-sm text-fg shadow-[0_0_0_1px_var(--color-border)] hover:bg-bg"
              }
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {current.id === "intro" ? (
        <div className="space-y-6">
          <div className="space-y-3 text-sm leading-relaxed text-muted">
            <p>Thank you for beta testing MACH RUN — The Supersonic Retirement Calculator.</p>
            <p>
              Please walk through the app at machrun.com and record your observations, issues, and suggestions
              under each OODA section. Be as specific as you can (what you clicked, what you expected, what
              happened). Screenshots are welcome if you have them.
            </p>
            <p>
              This is not a test of you — it is a test of the tool. Honest feedback (including things that felt
              wrong or missing) is the most useful. None of the write-ups are required.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Name</span>
              <TextInput
                value={answers.name}
                disabled={readOnly}
                className={wide}
                onChange={(event) => patch({ name: event.target.value })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Email</span>
              <TextInput value={email || answers.email} readOnly disabled className={wide} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Date of testing</span>
              <TextInput
                type="date"
                value={answers.testedOn}
                disabled={readOnly}
                className={wide}
                onChange={(event) => patch({ testedOn: event.target.value })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Device</span>
              <select
                value={answers.deviceKind}
                disabled={readOnly}
                onChange={(event) => {
                  const kind: BetaDeviceKind = event.target.value === "mobile" || event.target.value === "desktop" ? event.target.value : "";
                  patch({ deviceKind: kind, os: "", browser: "", device: betaDeviceLine(kind, "", "") });
                }}
                className={selectClass}
              >
                <option value="">Select</option>
                {BETA_DEVICE_KINDS.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Operating system</span>
              <select
                value={answers.os}
                disabled={readOnly || !answers.deviceKind}
                onChange={(event) => {
                  const os = event.target.value;
                  const browser = betaBrowserLabel(answers.deviceKind, answers.browser) ? answers.browser : "";
                  patch({ os, browser, device: betaDeviceLine(answers.deviceKind, os, browser) });
                }}
                className={selectClass}
              >
                <option value="">{answers.deviceKind ? "Select" : "Select a device first"}</option>
                {answers.deviceKind
                  ? BETA_OS[answers.deviceKind].map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">Browser</span>
              <select
                value={answers.browser}
                disabled={readOnly || !answers.os}
                onChange={(event) => {
                  const browser = event.target.value;
                  patch({ browser, device: betaDeviceLine(answers.deviceKind, answers.os, browser) });
                }}
                className={selectClass}
              >
                <option value="">{answers.os ? "Select" : "Select an operating system first"}</option>
                {answers.deviceKind
                  ? BETA_BROWSERS[answers.deviceKind].map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            {!answers.deviceKind && answers.device.trim() ? (
              <p className="text-sm text-muted sm:col-span-2">Earlier note: {answers.device}</p>
            ) : null}
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium tracking-wide text-muted">Which plan did you use?</span>
              <select
                value={answers.plan}
                disabled={readOnly}
                onChange={(event) => {
                  const value = event.target.value;
                  const plan: BetaPlan = BETA_PLANS.some((row) => row.id === value) ? (value as BetaPlan) : "";
                  patch({ plan });
                }}
                className={selectClass}
              >
                <option value="">Select</option>
                {answers.plan === "paid" ? <option value="paid">{betaPlanLabel("paid")}</option> : null}
                {BETA_PLANS.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {section ? (
        <section className="space-y-3">
          {section.phase ? (
            <div>
              <h2 className="font-display text-2xl text-fg">{section.phase}</h2>
              {section.phaseNote ? <p className="mt-1 text-sm text-muted">{section.phaseNote}</p> : null}
            </div>
          ) : null}
          <h3 className="text-base font-semibold text-fg">{section.title}</h3>
          <div className="space-y-5">
            {section.prompts.map((line, index) => (
              <div key={line} className="space-y-2">
                <p className="text-sm leading-relaxed text-fg">{line}</p>
                <TextArea
                  value={answers.sections[section.key].replies[index] ?? ""}
                  disabled={readOnly}
                  rows={3}
                  className={wide}
                  onChange={(event) => {
                    const replies = section.prompts.map(
                      (_, replyIndex) => answers.sections[section.key].replies[replyIndex] ?? "",
                    );
                    replies[index] = event.target.value;
                    patchSection(section.key, { replies });
                  }}
                />
              </div>
            ))}
          </div>
          {answers.sections[section.key].notes.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {answers.sections[section.key].notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {current.id === "hat" ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Thank-you gift — mailing address</h2>
          <p className="text-sm leading-relaxed text-muted">
            As a thank-you for beta testing, I’ll be sending you a MACH RUN hat. Please complete the address below so I can mail it to you.
          </p>
          {addressOnFile ? (
            <p className="text-sm text-fg">We already have this address from an earlier debrief.</p>
          ) : null}
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted">Full name (as it should appear on the package)</span>
            <TextInput
              value={answers.hat.fullName}
              disabled={readOnly || answers.hat.decline}
              className={wide}
              onChange={(event) => patchHat({ fullName: event.target.value })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted">Street address (line 1)</span>
            <TextInput
              value={answers.hat.line1}
              disabled={readOnly || answers.hat.decline}
              className={wide}
              onChange={(event) => patchHat({ line1: event.target.value })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted">Street address (line 2 — apt, suite, etc.)</span>
            <TextInput
              value={answers.hat.line2}
              disabled={readOnly || answers.hat.decline}
              className={wide}
              onChange={(event) => patchHat({ line2: event.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">City</span>
              <TextInput
                value={answers.hat.city}
                disabled={readOnly || answers.hat.decline}
                className={wide}
                onChange={(event) => patchHat({ city: event.target.value })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">State</span>
              <TextInput
                value={answers.hat.state}
                disabled={readOnly || answers.hat.decline}
                className={wide}
                onChange={(event) => patchHat({ state: event.target.value })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium tracking-wide text-muted">ZIP</span>
              <TextInput
                value={answers.hat.zip}
                disabled={readOnly || answers.hat.decline}
                className={wide}
                onChange={(event) => patchHat({ zip: event.target.value })}
              />
            </label>
          </div>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted">Country (if outside the U.S.)</span>
            <TextInput
              value={answers.hat.country}
              disabled={readOnly || answers.hat.decline}
              className={wide}
              onChange={(event) => patchHat({ country: event.target.value })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted">Any special delivery notes or preferences</span>
            <TextArea
              value={answers.hat.notes}
              disabled={readOnly || answers.hat.decline}
              rows={3}
              className={wide}
              onChange={(event) => patchHat({ notes: event.target.value })}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-1"
              checked={answers.hat.decline}
              disabled={readOnly}
              onChange={(event) => patchHat({ decline: event.target.checked })}
            />
            Please do not send a hat
          </label>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <GhostButton onClick={() => go(step - 1)} disabled={busy != null}>
            Back
          </GhostButton>
        ) : null}
        {!last ? (
          <PrimaryButton onClick={() => go(step + 1)} disabled={busy != null}>
            Next
          </PrimaryButton>
        ) : null}
        {!readOnly && onDraft ? (
          <GhostButton onClick={onDraft} disabled={busy != null}>
            {busy === "draft" ? "Saving…" : "Save draft"}
          </GhostButton>
        ) : null}
        {!readOnly && last && onSubmit ? (
          <PrimaryButton onClick={onSubmit} disabled={busy != null}>
            {busy === "submit" ? "Submitting…" : "Submit"}
          </PrimaryButton>
        ) : null}
      </div>
    </div>
  );
}
