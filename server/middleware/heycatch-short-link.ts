/**
 * HeyCatch reserves single-character paths for channel attribution.
 * Forward /a–/z and /0–/9 before the app can 404 them.
 */
interface HeyCatchEvent {
  url: URL;
}

export default function heycatchShortLink(
  event: HeyCatchEvent,
  next: () => unknown,
): unknown {
  const match = /^\/([a-z0-9])$/.exec(event.url.pathname);
  if (!match) return next();
  return new Response(null, {
    status: 302,
    headers: {
      location: `/?utm_source=heycatch&utm_campaign=${match[1]}`,
      "cache-control": "no-store",
    },
  });
}
