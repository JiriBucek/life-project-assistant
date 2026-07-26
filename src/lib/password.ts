import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * Password hashing on Node's built-in scrypt — memory-hard, no dependency.
 *
 * Stored as `scrypt$N$r$p$salt$hash` so the cost parameters travel with the
 * hash: raising them later still verifies every password already on disk.
 */
const N = 16384; // CPU/memory cost — ~16MB and ~50ms per hash
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Constant-time verify. Returns false rather than throwing on a malformed or
 * absent hash, so a Google-only account (no password) simply can't sign in
 * with one.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltHex, keyHex] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = await scrypt(password, salt, expected.length, { N: n, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * A real hash of a value nobody can supply, used when the email doesn't exist.
 *
 * Verifying against it costs the same ~50ms as a genuine check, so the login
 * response time can't be used to tell "no such account" from "wrong password".
 * Computed once, lazily, and shared.
 */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(32).toString("hex"));
  return dummy;
}

/**
 * One canonical spelling of an address. Emails are stored lower-cased because
 * the unique index is case-sensitive on both SQLite and PostgreSQL — without
 * this, `Jiri@x.com` and `jiri@x.com` would be two different accounts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
