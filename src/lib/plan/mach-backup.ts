const BACKUP_TYPE = "mach-run-backup";
const BACKUP_VERSION = 1;
const KDF = "PBKDF2";
const HASH = "SHA-256";
const ITERATIONS = 210_000;
const CIPHER = "AES-GCM";
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type MachBackupEnvelope = {
  type: typeof BACKUP_TYPE;
  version: typeof BACKUP_VERSION;
  kdf: typeof KDF;
  hash: typeof HASH;
  iter: typeof ITERATIONS;
  cipher: typeof CIPHER;
  salt: string;
  iv: string;
  ciphertext: string;
};

function requirePassword(password: string): string {
  const p = password ?? "";
  if (!p || !p.trim()) {
    throw new Error("Backup password cannot be empty.");
  }
  return p;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: HASH,
    },
    material,
    { name: CIPHER, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(payload: unknown, password: string): Promise<string> {
  const pass = requirePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(pass, salt);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = await crypto.subtle.encrypt(
    { name: CIPHER, iv: iv.buffer as ArrayBuffer },
    key,
    plain,
  );
  const envelope: MachBackupEnvelope = {
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    kdf: KDF,
    hash: HASH,
    iter: ITERATIONS,
    cipher: CIPHER,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(sealed)),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(fileText: string, password: string): Promise<unknown> {
  const pass = requirePassword(password);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("That file is not a MACH RUN backup.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("That file is not a MACH RUN backup.");
  }
  const env = parsed as Partial<MachBackupEnvelope>;
  if (env.type !== BACKUP_TYPE || env.version !== BACKUP_VERSION) {
    throw new Error("Unknown backup type.");
  }
  if (
    env.kdf !== KDF ||
    env.hash !== HASH ||
    env.cipher !== CIPHER ||
    typeof env.iter !== "number" ||
    typeof env.salt !== "string" ||
    typeof env.iv !== "string" ||
    typeof env.ciphertext !== "string"
  ) {
    throw new Error("Unknown backup type.");
  }
  const salt = b64ToBytes(env.salt);
  const iv = b64ToBytes(env.iv);
  const ciphertext = b64ToBytes(env.ciphertext);
  const key = await deriveKey(pass, salt);
  let opened: ArrayBuffer;
  try {
    opened = await crypto.subtle.decrypt(
      { name: CIPHER, iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    );
  } catch {
    throw new Error("Wrong backup password.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(opened)) as unknown;
  } catch {
    throw new Error("Backup file is damaged.");
  }
}
