import { useEffect, useState } from "react";
import { conversionDeskFn } from "@/lib/conversions/desk-api";
import type { ConversionWindow } from "@/lib/conversions/desk";

export function ConversionsDesk() {
  const [windows, setWindows] = useState<ConversionWindow[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    void conversionDeskFn()
      .then((result) => {
        if (!live) return;
        if (!result.allowed) {
          setMissing(true);
          return;
        }
        setWindows(result.windows);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (missing || !windows) return null;

  return (
    <section className="space-y-3">
      <p className="max-w-3xl text-sm text-muted">
        Counts only. Paid now means the linked account is paid today. It is not the day they paid.
      </p>
      <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Window</th>
              <th className="px-4 py-3 font-medium">Visitors</th>
              <th className="px-4 py-3 font-medium">Six questions finished</th>
              <th className="px-4 py-3 font-medium">Retired-pay result</th>
              <th className="px-4 py-3 font-medium">Hale demo opened</th>
              <th className="px-4 py-3 font-medium">Now an account</th>
              <th className="px-4 py-3 font-medium">Paid now</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((window) => (
              <tr key={window.label} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-fg">{window.label}</td>
                <td className="px-4 py-3 tabular-nums">{window.visitors}</td>
                <td className="px-4 py-3 tabular-nums">{window.quiz}</td>
                <td className="px-4 py-3 tabular-nums">{window.retiredPay}</td>
                <td className="px-4 py-3 tabular-nums">{window.demo}</td>
                <td className="px-4 py-3 tabular-nums">{window.accounts}</td>
                <td className="px-4 py-3 tabular-nums">{window.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
