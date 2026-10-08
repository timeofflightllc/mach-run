import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { paidFromStatus } from "@/lib/billing/limits";

const SYSTEM = `You are OODA AI inside MACH RUN. You are not Grok, not ChatGPT, and not a fiduciary. Never name those products.

You are in a conversation. Answer the question they just asked. Use a number from the MACH RUN snapshot only when the question needs it. If a number is not in the snapshot, say you do not have it. Do not invent balances, Social Security amounts, or tax law.

Do not recap the analysis. Earlier answers in this thread may have done that. Do not copy them. Do not mention peer rank, save rate, runway, paychecks, RMDs, or retirement landing unless they asked about that. Do not compliment their discipline unless they asked how they are doing. Do not restate the question. Short, plain sentences, like a text message. No sign-off.

The screen already shows the entertainment disclaimer. Do not add it, and do not tell them to confirm with SSA, DFAS, VA, or an advisor.`;

function apiKey(): string | null {
  try {
    return process.env.XAI_API_KEY || process.env.GROK_API_KEY || null;
  } catch {
    return null;
  }
}

export const askMachOoda = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { question: string; context: string }) => ({
    question: String(input?.question ?? "").trim().slice(0, 600),
    context: String(input?.context ?? "").trim().slice(0, 4000),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true; answer: string } | { ok: false; error: string }> => {
    try {
      const { loadSubscription, dropIfUnknownToStripe } = await import(
        "@/lib/billing/stripe.server"
      );
      const row = await loadSubscription(context.userId);
      await dropIfUnknownToStripe(context.userId, row);
      const fresh = await loadSubscription(context.userId);
      if (!paidFromStatus(fresh?.status)) {
        return {
          ok: false,
          error: "OODA AI is on Unlimited. $4/month or $40/year.",
        };
      }
    } catch {
      return { ok: false, error: "Sign in on Unlimited to use OODA AI." };
    }
    const key = apiKey();
    if (!key) {
      return {
        ok: false,
        error:
          "OODA AI is not connected yet. Add XAI_API_KEY in Vercel (from console.x.ai), then redeploy.",
      };
    }
    if (!data.question) {
      return { ok: false, error: "Ask a question first." };
    }
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-4.6",
          temperature: 0.6,
          max_tokens: 700,
          reasoning_effort: "low",
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `MACH RUN snapshot:\n${data.context || "(no Calculate yet)"}\n\nQuestion:\n${data.question}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: "OODA AI key was rejected. Check XAI_API_KEY." };
        }
        return {
          ok: false,
          error: `OODA AI is busy (${res.status}). ${body.slice(0, 120)}`,
        };
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = json.choices?.[0]?.message?.content?.trim();
      if (!answer) return { ok: false, error: "OODA AI returned an empty brief." };
      return { ok: true, answer };
    } catch {
      return { ok: false, error: "OODA AI could not reach the wire. Try again." };
    }
  });
