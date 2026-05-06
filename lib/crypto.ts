import crypto from "crypto";

// MVP NOTE:
// The full spec (section 4.9) uses AWS KMS envelope encryption with per-record
// data encryption keys. For the personal-demo MVP, we use a single AES-256-GCM
// key stored in an env var. This is FINE for a personal dev account but MUST
// be replaced with KMS before any public/multi-tenant deployment.

const KEY_B64 = process.env.TOKEN_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_B64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY env var not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const key = Buffer.from(KEY_B64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

/** Encrypts plaintext to base64(iv ‖ tag ‖ ciphertext). */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypts base64(iv ‖ tag ‖ ciphertext) back to plaintext. */
export function decryptToken(blobB64: string): string {
  const key = getKey();
  const blob = Buffer.from(blobB64, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
