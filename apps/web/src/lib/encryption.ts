/**
 * Per-user LinkedIn session encryption.
 * Uses AES-256-GCM with a key derived from env + user id.
 * In production, use a dedicated KMS or vault for keys.
 */

const ALG = 'AES-GCM';
const KEY_LEN = 256;
const IV_LEN = 12;
const SALT_LEN = 16;

function getSecret(): string {
  const secret = process.env.SESSION_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret) throw new Error('SESSION_ENCRYPTION_SECRET or NEXT_PUBLIC_SUPABASE_ANON_KEY required');
  return secret;
}

async function deriveKey(salt: Uint8Array, secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALG, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSession(userId: string, payload: string): Promise<string> {
  const secret = getSecret();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(salt, secret + userId);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: ALG, iv },
    key,
    enc.encode(payload)
  );
  const combined = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipher), salt.length + iv.length);
  return Buffer.from(combined).toString('base64');
}

export async function decryptSession(userId: string, encrypted: string): Promise<string> {
  const secret = getSecret();
  const combined = Buffer.from(encrypted, 'base64');
  const salt = combined.subarray(0, SALT_LEN);
  const iv = combined.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const data = combined.subarray(SALT_LEN + IV_LEN);
  const key = await deriveKey(new Uint8Array(salt), secret + userId);
  const dec = await crypto.subtle.decrypt({ name: ALG, iv: new Uint8Array(iv) }, key, data);
  return new TextDecoder().decode(dec);
}
