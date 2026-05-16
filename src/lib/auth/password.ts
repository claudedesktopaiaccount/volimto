/**
 * PBKDF2 password hashing using Web Crypto API.
 * Compatible with serverless runtimes (no Node.js crypto module).
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

/**
 * Hash a password using PBKDF2/SHA-256.
 * Returns format: hex(salt):hex(derivedKey)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const derived = await deriveKey(password, salt);
  return `${bufferToHex(salt.buffer as ArrayBuffer)}:${bufferToHex(derived)}`;
}

/**
 * Verify a password against a stored hash.
 * Stored format: hex(salt):hex(derivedKey)
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  try {
    const salt = hexToBuffer(saltHex);
    const derived = await deriveKey(password, salt);
    const derivedHex = bufferToHex(derived);

    // Constant-time comparison to prevent timing attacks
    if (derivedHex.length !== hashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < derivedHex.length; i++) {
      diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
