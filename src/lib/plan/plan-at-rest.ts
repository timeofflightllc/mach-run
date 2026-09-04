const TYPE = "mach-plan-at-rest";
const ALG = "AES-GCM";

type Envelope = {
  t: typeof TYPE;
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  data: string;
  tag?: string;
};

function secretSource(): string | null {
  const raw =
    typeof process !== "undefined" ? process.env.MACH_PLAN_AT_REST_KEY?.trim() : "";
  if (raw && raw.length >= 16) return raw;
  const vercelEnv =
    typeof process !== "undefined" ? process.env.VERCEL_ENV : undefined;
  if (vercelEnv === "production") return null;
  return "mach-run-preview-at-rest-v1";
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function keyBytes(): Promise<CryptoKey | null> {
  const secret = secretSource();
  if (!secret) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, ALG, false, ["encrypt", "decrypt"]);
}

export function isAtRestEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const o = value as Envelope;
  return (
    o.t === TYPE &&
    o.v === 1 &&
    typeof o.iv === "string" &&
    typeof o.data === "string"
  );
}

export async function sealPlanPayload(payload: unknown): Promise<unknown> {
  const key = await keyBytes();
  if (!key) return payload;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = await crypto.subtle.encrypt({ name: ALG, iv }, key, plain);
  const env: Envelope = {
    t: TYPE,
    v: 1,
    alg: "aes-256-gcm",
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(sealed)),
  };
  return env;
}

export async function openPlanPayload(raw: unknown): Promise<unknown> {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (!isAtRestEnvelope(parsed)) return parsed;
  const key = await keyBytes();
  if (!key) throw new Error("plan at rest: missing MACH_PLAN_AT_REST_KEY");
  const iv = b64ToBytes(parsed.iv);
  let data = b64ToBytes(parsed.data);
  if (parsed.tag) {
    const tag = b64ToBytes(parsed.tag);
    const joined = new Uint8Array(data.length + tag.length);
    joined.set(data);
    joined.set(tag, data.length);
    data = joined;
  }
  const plain = await crypto.subtle.decrypt(
    { name: ALG, iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as unknown;
}
