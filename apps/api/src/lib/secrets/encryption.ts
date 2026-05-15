import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_ENV_VAR = "ENCRYPTION_KEY";

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

function deriveKey(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}

function getEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV_VAR];
  if (!raw) {
    throw new EncryptionError(
      `${KEY_ENV_VAR} environment variable is not set. ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return deriveKey(raw);
}

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    iv: iv.toString("hex"),
    ciphertext,
    tag,
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    let plaintext = decipher.update(payload.ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");
    return plaintext;
  } catch (err) {
    throw new EncryptionError(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function serializeEncrypted(payload: EncryptedPayload): string {
  return `${payload.iv}:${payload.ciphertext}:${payload.tag}`;
}

export function parseEncrypted(serialized: string): EncryptedPayload {
  const parts = serialized.split(":");
  if (parts.length < 3) {
    throw new EncryptionError("Invalid encrypted payload format");
  }
  return { iv: parts[0]!, ciphertext: parts.slice(1, -1).join(":"), tag: parts[parts.length - 1]! };
}
