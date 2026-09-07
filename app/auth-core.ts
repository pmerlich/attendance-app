export type SessionIdentity = { userId: string; email: string; displayName: string; firstName: string; lastName: string; phone: string; businessId: string; ownerId: string; role: "manager" | "employee"; profileImageKey?: string | null; isLocal: boolean; isGuest: boolean };

const SESSION_COOKIE = "menahel_session";
const SESSION_DAYS = 365;
const PBKDF2_ITERATIONS = 310_000;

function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(value: string) { if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("invalid hex"); return Uint8Array.from(value.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16)); }
export function randomToken(bytes = 32) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return bytesToHex(value); }
export async function sha256(value: string) { return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }

export async function hashPassword(password: string, saltHex = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${saltHex}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(iterations) !== PBKDF2_ITERATIONS || !salt) return false;
  const candidate = await hashPassword(password, salt);
  if (candidate.length !== stored.length) return false;
  let mismatch = 0;
  for (let index = 0; index < stored.length; index += 1) mismatch |= candidate.charCodeAt(index) ^ stored.charCodeAt(index);
  return mismatch === 0;
}

export function sessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const item of cookie.split(";")) { const [name, ...parts] = item.trim().split("="); if (name === SESSION_COOKIE) return decodeURIComponent(parts.join("=")); }
  return null;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
export function clearSessionCookie(request: Request) { return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`; }

export async function resolveSessionIdentity(db: D1Database, request: Request): Promise<SessionIdentity | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(`SELECT u.id AS ownerId, u.auth_user_id AS userId, u.email, u.display_name AS displayName,
    COALESCE(u.first_name, '') AS firstName, COALESCE(u.last_name, '') AS lastName, COALESCE(u.phone, '') AS phone,
    u.business_id AS businessId, u.role, u.profile_image_key AS profileImageKey
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND u.deleted_at IS NULL AND u.is_active = 1 LIMIT 1`).bind(tokenHash).first<SessionIdentity>();
  if (!row) return null;
  await db.prepare("UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP, expires_at = datetime('now', ?) WHERE token_hash = ?").bind(`+${SESSION_DAYS} days`, tokenHash).run();
  return { ...row, userId: row.userId || row.ownerId, isLocal: false, isGuest: false };
}

export async function ensureAuthSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at text NOT NULL, last_used_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, revoked_at text)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_tokens (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, token_hash text NOT NULL UNIQUE, purpose text NOT NULL, expires_at text NOT NULL, used_at text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_login_attempts (id text PRIMARY KEY NOT NULL, attempt_key text NOT NULL, succeeded integer DEFAULT 0 NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions (user_id, revoked_at, expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose, used_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_key_created ON auth_login_attempts (attempt_key, created_at)"),
  ]);
  const columns = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const additions = [["first_name", "ALTER TABLE users ADD COLUMN first_name text DEFAULT '' NOT NULL"], ["last_name", "ALTER TABLE users ADD COLUMN last_name text DEFAULT '' NOT NULL"], ["phone", "ALTER TABLE users ADD COLUMN phone text DEFAULT '' NOT NULL"], ["password_hash", "ALTER TABLE users ADD COLUMN password_hash text"], ["profile_image_key", "ALTER TABLE users ADD COLUMN profile_image_key text"], ["email_verified_at", "ALTER TABLE users ADD COLUMN email_verified_at text"]] as const;
  for (const [name, sql] of additions) if (!columns.results.some((column) => column.name === name)) await db.prepare(sql).run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_login_email_unique ON users (lower(email)) WHERE password_hash IS NOT NULL AND deleted_at IS NULL").run();
}

export async function createSession(db: D1Database, userId: string, request: Request) {
  const token = randomToken();
  await db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', ?))").bind(crypto.randomUUID(), userId, await sha256(token), `+${SESSION_DAYS} days`).run();
  return sessionCookie(token, request);
}
