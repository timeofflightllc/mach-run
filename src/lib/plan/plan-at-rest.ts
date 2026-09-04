import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TYPE = "mach-plan-at-rest";
const ALG = "aes-256-gcm";

type Envelope = {
  t: typeof TYPE;
  v: 1;
  alg: typeof ALG;
  iv: string;
  tag: string;
  data: string;
};

function keyBytes(): Buffer | null {
  const raw = process.env.MACH_PLAN_AT_REST_KEY?.trim();
  if (raw && raw.length >= 16) {
    return createHash("sha256").update(raw).digest();
  }
  if (process.env.VERCEL_ENV === "production") return null;
  return createHash("sha256").update("mach-run-preview-at-rest-v1").digest();
}

export function isAtRestEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const o = value as Envelope;
  return (
    o.t === TYPE &&
    o.v === 1 &&
    o.alg === ALG &&
    typeof o.iv === "string" &&
    typeof o.tag === "string" &&
    typeof o.data === "string"
  );
}

export function sealPlanPayload(payload: unknown): unknown {
  const key = keyBytes();
  if (!key) return payload;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const env: Envelope = {
    t: TYPE,
    v: 1,
    alg: ALG,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
  return env;
}

export function openPlanPayload(raw: unknown): unknown {
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
  const key = keyBytes();
  if (!key) throw new Error("plan at rest: missing MACH_PLAN_AT_REST_KEY");
  const decipher = createDecipheriv(ALG, key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8")) as unknown;
}
