import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import type { SiteAnnouncement, SiteCopy, SitePage, SitePageSlug } from "./types";
import { SITE_PAGE_SLUGS } from "./types";
import { defaultAnnouncements, DEFAULT_PAGES } from "./defaults";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({
      context: { bearerToken: context.bearerToken as string | undefined },
    });
  });

function emptyCopy(): SiteCopy {
  return { pages: DEFAULT_PAGES, announcements: defaultAnnouncements() };
}

export const loadPublicSiteCopy = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteCopy> => {
    try {
      const { loadSiteCopy } = await import("./server");
      return await loadSiteCopy();
    } catch {
      return emptyCopy();
    }
  },
);

export const loadOpsSiteCopy = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }): Promise<{ allowed: boolean; copy: SiteCopy }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false, copy: emptyCopy() };
    const { loadSiteCopy } = await import("./server");
    return { allowed: true, copy: await loadSiteCopy() };
  });

export const saveOpsSitePageFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { slug: string; title: string; kicker: string; body: string }) => ({
    slug: String(input?.slug ?? ""),
    title: String(input?.title ?? ""),
    kicker: String(input?.kicker ?? ""),
    body: String(input?.body ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false, error: "Not allowed." };
    if (!(SITE_PAGE_SLUGS as readonly string[]).includes(data.slug)) {
      return { ok: false, error: "Unknown page." };
    }
    const { saveSitePage } = await import("./server");
    const error = await saveSitePage(data as SitePage);
    return error ? { ok: false, error } : { ok: true };
  });

export const saveOpsAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: Partial<SiteAnnouncement>) => ({
    id: String(input?.id ?? ""),
    at: String(input?.at ?? ""),
    title: String(input?.title ?? ""),
    blurb: String(input?.blurb ?? ""),
    sortOrder: Number(input?.sortOrder) || 0,
  }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false, error: "Not allowed." };
    const { nextAnnouncementOrder, saveAnnouncement } = await import("./server");
    const sortOrder = data.sortOrder || (await nextAnnouncementOrder());
    const error = await saveAnnouncement({
      id: data.id,
      at: data.at,
      title: data.title,
      blurb: data.blurb,
      sortOrder,
    });
    return error ? { ok: false, error } : { ok: true };
  });

export const deleteOpsAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { getOpsActor } = await import("@/lib/ops/gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false, error: "Not allowed." };
    const { deleteAnnouncement } = await import("./server");
    const error = await deleteAnnouncement(data.id);
    return error ? { ok: false, error } : { ok: true };
  });

export function pageBySlug(copy: SiteCopy, slug: SitePageSlug): SitePage {
  return copy.pages.find((p) => p.slug === slug) ?? DEFAULT_PAGES.find((p) => p.slug === slug)!;
}
