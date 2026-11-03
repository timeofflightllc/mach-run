import { BETA_SECTIONS, type BetaAnswers, type BetaSectionKey } from "@/lib/beta/form";
import { TextArea, TextInput } from "@/components/ui/field";

const wide = "w-full min-w-0 max-w-none";

export function DebriefForm({
  answers,
  email,
  readOnly = false,
  addressOnFile = false,
  onChange,
}: {
  answers: BetaAnswers;
  email: string;
  readOnly?: boolean;
  addressOnFile?: boolean;
  onChange?: (next: BetaAnswers) => void;
}) {
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

  return (
    <div className="space-y-8">
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
          <span className="text-xs font-medium tracking-wide text-muted">Device / browser used</span>
          <TextInput
            value={answers.device}
            disabled={readOnly}
            className={wide}
            onChange={(event) => patch({ device: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="text-xs font-medium tracking-wide text-muted">
            Did you use the free plan or a paid plan?
          </span>
          <select
            value={answers.plan}
            disabled={readOnly}
            onChange={(event) => patch({ plan: event.target.value === "paid" || event.target.value === "free" ? event.target.value : "" })}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 text-sm text-fg outline-none disabled:opacity-50"
          >
            <option value="">Select</option>
            <option value="free">Free plan</option>
            <option value="paid">Paid plan</option>
          </select>
        </label>
      </div>

      {BETA_SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          {section.phase ? (
            <div>
              <h2 className="font-display text-2xl text-fg">{section.phase}</h2>
              {section.phaseNote ? <p className="mt-1 text-sm text-muted">{section.phaseNote}</p> : null}
            </div>
          ) : null}
          <h3 className="text-base font-semibold text-fg">{section.title}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
            {section.prompts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <TextArea
            value={answers.sections[section.key].notes}
            disabled={readOnly}
            rows={6}
            className={wide}
            onChange={(event) => patchSection(section.key, { notes: event.target.value })}
          />
          <label className="flex items-start gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-1"
              checked={answers.sections[section.key].continued}
              disabled={readOnly}
              onChange={(event) => patchSection(section.key, { continued: event.target.checked })}
            />
            Continued in a separate writeup (attach additional notes)
          </label>
        </section>
      ))}

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
    </div>
  );
}
