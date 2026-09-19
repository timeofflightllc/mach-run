import { verifyPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";

/**
 * Confirm the signed-in desk owner by their MACH RUN email password.
 * Apple / Google / X alone are not enough — set a password on Account profile.
 */
export async function verifyOpsDeskPassword(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!password) {
    return { ok: false, error: "Type your desk password to delete." };
  }
  try {
    const sql = await getSql();
    const rows = await sql.query<{ password: string | null }>(
      `select password from "account"
       where "userId" = $1
         and password is not null
         and length(password) > 0
       limit 1`,
      [userId],
    );
    const hash = rows[0]?.password;
    if (!hash) {
      return {
        ok: false,
        error:
          "Set a MACH RUN password on Account profile first. Apple, Google, or X sign-in is not the desk password.",
      };
    }
    const ok = await verifyPassword({ hash, password });
    if (!ok) {
      return { ok: false, error: "That password does not match this desk login." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not check that password." };
  }
}
