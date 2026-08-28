/**
 * Sign in with Apple (web). Better Auth needs a JWT client secret minted from
 * the .p8 key — not a static string. All four APPLE_* vars must be set or
 * Apple stays off (Google/X/email keep working).
 */
import { importPKCS8, SignJWT } from "jose";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

function privateKeyPem(): string | undefined {
  const raw = env("APPLE_PRIVATE_KEY");
  if (!raw) return undefined;
  return raw.includes("-----BEGIN") ? raw.replace(/\\n/g, "\n") : undefined;
}

export const appleConfigured = Boolean(
  env("APPLE_CLIENT_ID") &&
    env("APPLE_TEAM_ID") &&
    env("APPLE_KEY_ID") &&
    privateKeyPem(),
);

export async function generateAppleClientSecret(): Promise<string> {
  const clientId = env("APPLE_CLIENT_ID");
  const teamId = env("APPLE_TEAM_ID");
  const keyId = env("APPLE_KEY_ID");
  const pem = privateKeyPem();
  if (!clientId || !teamId || !keyId || !pem) {
    throw new Error("Apple Sign In is not configured.");
  }
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 86400 * 150)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);
}

export async function appleSocialProvider(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  if (!appleConfigured) return null;
  const clientId = env("APPLE_CLIENT_ID") as string;
  const clientSecret = await generateAppleClientSecret();
  return { clientId, clientSecret };
}
