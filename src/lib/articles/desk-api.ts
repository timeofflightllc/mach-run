import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { ArticleRecord } from "./types";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context.bearerToken as string | undefined } });
  });

export const listOpsArticlesFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: false } | { allowed: true; articles: ArticleRecord[] }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false };
    const { listArticles } = await import("./server");
    return { allowed: true, articles: await listArticles() };
  });

export const saveOpsArticleFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { slug?: string; pageTitle?: string; h1?: string; body?: string; date?: string }) => ({
    slug: String(input?.slug ?? ""),
    pageTitle: String(input?.pageTitle ?? ""),
    h1: String(input?.h1 ?? ""),
    body: String(input?.body ?? ""),
    date: String(input?.date ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false, error: "Not allowed." };
    const { saveArticle } = await import("./server");
    const error = await saveArticle(data.slug, data.pageTitle, data.h1, data.body, data.date);
    return error ? { ok: false, error } : { ok: true };
  });

export const createOpsArticleFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { slug?: string; pageTitle?: string; h1?: string; body?: string; date?: string }) => ({
    slug: String(input?.slug ?? "").trim(),
    pageTitle: String(input?.pageTitle ?? ""),
    h1: String(input?.h1 ?? ""),
    body: String(input?.body ?? ""),
    date: String(input?.date ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false, error: "Not allowed." };
    const { createArticle } = await import("./server");
    const error = await createArticle(data.slug, data.pageTitle, data.h1, data.body, data.date);
    return error ? { ok: false, error } : { ok: true };
  });
