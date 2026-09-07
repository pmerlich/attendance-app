import { env } from "cloudflare:workers";
import { clearSessionCookie, createSession, ensureAuthSchema, hashPassword, randomToken, resolveSessionIdentity, sessionToken, sha256, verifyPassword } from "../../auth-core";
import { sendPasswordResetEmail } from "../../email";

type AuthEnv = { DB: D1Database; FILES: R2Bucket; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };
const authEnv = env as unknown as AuthEnv;

function clean(value: FormDataEntryValue | null, max: number) { const text = String(value ?? "").trim(); return text && text.length <= max ? text : null; }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
// Minimum raised from 10 to 12 (L-02) to align with the common 12-character security
// baseline. This only affects registration and choosing a NEW password on changePassword -
// login never calls validPassword(), so existing users with a shorter password already set
// keep logging in with it unchanged.
function validPassword(value: string) { return value.length >= 12 && value.length <= 128 && /[A-Za-z\p{L}]/u.test(value) && /\d/.test(value); }
function sameOrigin(request: Request) { const origin = request.headers.get("origin"); return !origin || origin === new URL(request.url).origin; }
function validImageSignature(type: string, bytes: Uint8Array) { const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length)); if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; if (type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]); return type === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP"; }
async function loginKey(request: Request, email: string) { return sha256(`${request.headers.get("cf-connecting-ip") ?? "local"}:${email}`); }
// Distinct hash namespaces from loginKey() so password-reset requests never inflate the
// login lockout counter (that counter only filters by attempt_key, so an unrelated key
// prefix is enough to keep the two rate limits from contaminating each other).
async function resetRequestKey(request: Request, email: string) { return sha256(`reset-request:${request.headers.get("cf-connecting-ip") ?? "local"}:${email}`); }
async function resetConsumeKey(request: Request) { return sha256(`reset-consume:${request.headers.get("cf-connecting-ip") ?? "local"}`); }
function contactFieldError(firstName: string | null, lastName: string | null, phone: string | null, email: string | null) {
  if (!firstName) return "יש להזין שם פרטי (עד 80 תווים)";
  if (!lastName) return "יש להזין שם משפחה (עד 80 תווים)";
  if (!phone) return "יש להזין מספר טלפון (עד 40 תווים)";
  if (!email) return "יש להזין כתובת אימייל";
  if (!validEmail(email)) return "כתובת האימייל אינה תקינה";
  return null;
}

async function ensureBaseSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS businesses (id text PRIMARY KEY NOT NULL, name text NOT NULL, work_mode text DEFAULT 'solo' NOT NULL, currency text DEFAULT 'EUR' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text)"),
    db.prepare("CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, business_id text NOT NULL, auth_user_id text, email text NOT NULL, display_name text NOT NULL, role text NOT NULL, hourly_cost real, hourly_cost_cents integer, is_active integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text)"),
    db.prepare("CREATE TABLE IF NOT EXISTS auth_login_attempts (id text PRIMARY KEY NOT NULL, attempt_key text NOT NULL, succeeded integer DEFAULT 0 NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_key_created ON auth_login_attempts (attempt_key, created_at)"),
  ]);
  await ensureAuthSchema(db);
}

function json(body: unknown, status = 200, cookie?: string | string[]) {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const value of cookie ? (Array.isArray(cookie) ? cookie : [cookie]) : []) headers.append("set-cookie", value);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function GET(request: Request) {
  await ensureBaseSchema(authEnv.DB);
  const identity = await resolveSessionIdentity(authEnv.DB, request);
  if (!identity) return json({ authenticated: false }, 401);
  if (new URL(request.url).searchParams.get("profile") === "1") {
    const row = await authEnv.DB.prepare("SELECT profile_image_key AS profileImageKey FROM users WHERE id = ? AND business_id = ? LIMIT 1").bind(identity.ownerId, identity.businessId).first<{ profileImageKey: string | null }>();
    if (!row?.profileImageKey) return new Response(null, { status: 404 });
    const object = await authEnv.FILES.get(row.profileImageKey);
    if (!object) return new Response(null, { status: 404 });
    const headers = new Headers({ "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" });
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
  }
  return json({ authenticated: true, user: identity });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "הבקשה נדחתה" }, 403);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 6 * 1024 * 1024) return json({ error: "הבקשה גדולה מדי" }, 413);
  await ensureBaseSchema(authEnv.DB);
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "register") {
    const firstName = clean(form.get("firstName"), 80);
    const lastName = clean(form.get("lastName"), 80);
    const phone = clean(form.get("phone"), 40);
    const email = clean(form.get("email"), 254)?.toLocaleLowerCase() ?? null;
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const registerContactError = contactFieldError(firstName, lastName, phone, email);
    if (registerContactError) return json({ error: registerContactError }, 400);
    if (!validPassword(password)) return json({ error: "הסיסמה צריכה לכלול לפחות 12 תווים, אות אחת ומספר אחד לפחות" }, 400);
    if (password !== confirmPassword) return json({ error: "אימות הסיסמה אינו תואם לסיסמה שהוזנה" }, 400);
    const exists = await authEnv.DB.prepare("SELECT id FROM users WHERE lower(email) = ? AND password_hash IS NOT NULL AND deleted_at IS NULL LIMIT 1").bind(email).first();
    if (exists) return json({ error: "כבר קיים חשבון עם כתובת המייל הזאת" }, 409);
    const image = form.get("profileImage");
    let profileImageKey: string | null = null;
    if (image instanceof File && image.size > 0) {
      if (image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return json({ error: "תמונת הפרופיל חייבת להיות JPG, PNG או WEBP ועד 5MB" }, 400);
      const imageBytes = await image.arrayBuffer();
      if (!validImageSignature(image.type, new Uint8Array(imageBytes).slice(0, 16))) return json({ error: "תוכן תמונת הפרופיל אינו תואם לסוג הקובץ" }, 400);
      profileImageKey = `profiles/${crypto.randomUUID()}`;
      await authEnv.FILES.put(profileImageKey, imageBytes, { httpMetadata: { contentType: image.type } });
    }
    const businessId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const displayName = `${firstName} ${lastName}`;
    try {
      await authEnv.DB.batch([
        authEnv.DB.prepare("INSERT INTO businesses (id, name, work_mode, currency) VALUES (?, ?, 'solo', 'EUR')").bind(businessId, displayName),
        authEnv.DB.prepare("INSERT INTO users (id, business_id, auth_user_id, email, display_name, first_name, last_name, phone, password_hash, profile_image_key, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manager', 1)").bind(userId, businessId, userId, email, displayName, firstName, lastName, phone, await hashPassword(password), profileImageKey),
      ]);
    } catch (error) {
      if (profileImageKey) await authEnv.FILES.delete(profileImageKey).catch(() => undefined);
      if (String(error).includes("UNIQUE")) return json({ error: "כבר קיים חשבון עם כתובת המייל הזאת" }, 409);
      throw error;
    }
    return json({ authenticated: true }, 201, await createSession(authEnv.DB, userId));
  }

  if (action === "login") {
    const email = String(form.get("email") ?? "").trim().toLocaleLowerCase();
    const password = String(form.get("password") ?? "");
    const attemptKey = await loginKey(request, email);
    const attempts = await authEnv.DB.prepare("SELECT COUNT(*) AS count FROM auth_login_attempts WHERE attempt_key = ? AND succeeded = 0 AND created_at > datetime('now', '-15 minutes')").bind(attemptKey).first<{ count: number }>();
    if (Number(attempts?.count ?? 0) >= 10) return json({ error: "בוצעו יותר מדי ניסיונות כניסה. יש להמתין 15 דקות ולנסות שוב" }, 429);
    const user = await authEnv.DB.prepare("SELECT id, password_hash AS passwordHash FROM users WHERE lower(email) = ? AND password_hash IS NOT NULL AND deleted_at IS NULL AND is_active = 1 LIMIT 1").bind(email).first<{ id: string; passwordHash: string }>();
    if (!user || !(await verifyPassword(password, user.passwordHash))) { await authEnv.DB.prepare("INSERT INTO auth_login_attempts (id, attempt_key, succeeded) VALUES (?, ?, 0)").bind(crypto.randomUUID(), attemptKey).run(); return json({ error: "כתובת המייל או הסיסמה אינם נכונים" }, 401); }
    await authEnv.DB.prepare("INSERT INTO auth_login_attempts (id, attempt_key, succeeded) VALUES (?, ?, 1)").bind(crypto.randomUUID(), attemptKey).run();
    await authEnv.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND expires_at <= CURRENT_TIMESTAMP AND revoked_at IS NULL").bind(user.id).run();
    return json({ authenticated: true }, 200, await createSession(authEnv.DB, user.id));
  }

  if (action === "requestPasswordReset") {
    const email = String(form.get("email") ?? "").trim().toLocaleLowerCase();
    if (!email || !validEmail(email)) return json({ error: "כתובת האימייל אינה תקינה" }, 400);
    const attemptKey = await resetRequestKey(request, email);
    const attempts = await authEnv.DB.prepare("SELECT COUNT(*) AS count FROM auth_login_attempts WHERE attempt_key = ? AND created_at > datetime('now', '-15 minutes')").bind(attemptKey).first<{ count: number }>();
    if (Number(attempts?.count ?? 0) >= 5) return json({ error: "בוצעו יותר מדי בקשות לאיפוס סיסמה. יש להמתין 15 דקות ולנסות שוב" }, 429);
    await authEnv.DB.prepare("INSERT INTO auth_login_attempts (id, attempt_key, succeeded) VALUES (?, ?, 0)").bind(crypto.randomUUID(), attemptKey).run();
    const user = await authEnv.DB.prepare("SELECT id, email, first_name AS firstName FROM users WHERE lower(email) = ? AND password_hash IS NOT NULL AND deleted_at IS NULL AND is_active = 1 LIMIT 1").bind(email).first<{ id: string; email: string; firstName: string }>();
    if (user) {
      const rawToken = randomToken();
      await authEnv.DB.batch([
        // Invalidate any earlier unused reset link for this user so only the most recently
        // requested one can be used - otherwise an older leaked/forwarded email could still
        // reset the password after the user requested (and used) a newer one.
        authEnv.DB.prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = 'reset_password' AND used_at IS NULL").bind(user.id),
        authEnv.DB.prepare("INSERT INTO auth_tokens (id, user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, 'reset_password', datetime('now', '+1 hour'))").bind(crypto.randomUUID(), user.id, await sha256(rawToken)),
        // Opportunistic cleanup, piggybacked on a write this table already gets (same pattern
        // as offline_operations' 90-day prune below): used/expired tokens for this user are
        // never needed again, otherwise this table only ever grows.
        authEnv.DB.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at < CURRENT_TIMESTAMP)").bind(user.id),
      ]);
      const resetUrl = `${new URL(request.url).origin}/?resetToken=${rawToken}`;
      try {
        await sendPasswordResetEmail(authEnv, { to: user.email, name: user.firstName || "", resetUrl });
      } catch (error) {
        console.error("[auth] failed to send password reset email", error);
      }
    } else {
      // The "account exists" branch above does strictly more work (a db.batch() write plus an
      // outbound call to Resend) before reaching the same response below - a narrow timing side
      // channel for exactly what the identical response body is meant to hide. A small fixed
      // floor here isn't a perfect match for real-world network latency, but meaningfully closes
      // the gap for negligible cost; already bounded by the rate limit above either way.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    // Same response whether or not the address belongs to a real account, so this endpoint
    // cannot be used to enumerate registered emails.
    return json({ requested: true });
  }

  if (action === "resetPassword") {
    const token = String(form.get("token") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (!token) return json({ error: "קישור האיפוס אינו תקין" }, 400);
    if (!validPassword(password)) return json({ error: "הסיסמה צריכה לכלול לפחות 12 תווים, אות אחת ומספר אחד לפחות" }, 400);
    if (password !== confirmPassword) return json({ error: "אימות הסיסמה אינו תואם לסיסמה שהוזנה" }, 400);
    const consumeKey = await resetConsumeKey(request);
    const consumeAttempts = await authEnv.DB.prepare("SELECT COUNT(*) AS count FROM auth_login_attempts WHERE attempt_key = ? AND created_at > datetime('now', '-15 minutes')").bind(consumeKey).first<{ count: number }>();
    if (Number(consumeAttempts?.count ?? 0) >= 20) return json({ error: "בוצעו יותר מדי ניסיונות. יש להמתין 15 דקות ולנסות שוב" }, 429);
    const tokenHash = await sha256(token);
    const record = await authEnv.DB.prepare(`SELECT t.id AS tokenId, u.id AS userId FROM auth_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.purpose = 'reset_password' AND t.used_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP
        AND u.deleted_at IS NULL AND u.is_active = 1 LIMIT 1`).bind(tokenHash).first<{ tokenId: string; userId: string }>();
    if (!record) {
      await authEnv.DB.prepare("INSERT INTO auth_login_attempts (id, attempt_key, succeeded) VALUES (?, ?, 0)").bind(crypto.randomUUID(), consumeKey).run();
      return json({ error: "קישור האיפוס אינו תקין או שפג תוקפו. ניתן לבקש קישור חדש" }, 400);
    }
    // Resetting the password revokes every existing session (not just "other" sessions like
    // changePassword does) since, unlike changePassword, the requester never proved they hold
    // the current session - only that they control the mailbox the reset link went to.
    await authEnv.DB.batch([
      authEnv.DB.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(await hashPassword(password), record.userId),
      authEnv.DB.prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(record.tokenId),
      authEnv.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL").bind(record.userId),
    ]);
    return json({ authenticated: true }, 200, await createSession(authEnv.DB, record.userId));
  }

  if (action === "logout") {
    const token = sessionToken(request);
    if (token) await authEnv.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ authenticated: false }, 200, clearSessionCookie(request));
  }

  if (action === "updateProfile") {
    const identity = await resolveSessionIdentity(authEnv.DB, request);
    if (!identity) return json({ error: "יש להתחבר מחדש" }, 401);
    const firstName = clean(form.get("firstName"), 80);
    const lastName = clean(form.get("lastName"), 80);
    const phone = clean(form.get("phone"), 40);
    const email = clean(form.get("email"), 254)?.toLocaleLowerCase() ?? null;
    const profileContactError = contactFieldError(firstName, lastName, phone, email);
    if (profileContactError) return json({ error: profileContactError }, 400);
    const duplicate = await authEnv.DB.prepare("SELECT id FROM users WHERE lower(email) = ? AND id <> ? AND password_hash IS NOT NULL AND deleted_at IS NULL LIMIT 1").bind(email, identity.ownerId).first();
    if (duplicate) return json({ error: "כבר קיים חשבון עם כתובת המייל הזאת" }, 409);
    const current = await authEnv.DB.prepare("SELECT profile_image_key AS profileImageKey FROM users WHERE id = ? AND business_id = ?").bind(identity.ownerId, identity.businessId).first<{ profileImageKey: string | null }>();
    const image = form.get("profileImage");
    const removeImage = form.get("removeImage") === "1";
    let nextImageKey = removeImage ? null : current?.profileImageKey ?? null;
    let uploadedImageKey: string | null = null;
    if (image instanceof File && image.size > 0) {
      if (image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return json({ error: "תמונת הפרופיל חייבת להיות JPG, PNG או WEBP ועד 5MB" }, 400);
      const imageBytes = await image.arrayBuffer();
      if (!validImageSignature(image.type, new Uint8Array(imageBytes).slice(0, 16))) return json({ error: "תוכן תמונת הפרופיל אינו תואם לסוג הקובץ" }, 400);
      uploadedImageKey = `profiles/${crypto.randomUUID()}`;
      await authEnv.FILES.put(uploadedImageKey, imageBytes, { httpMetadata: { contentType: image.type } });
      nextImageKey = uploadedImageKey;
    }
    try {
      await authEnv.DB.prepare("UPDATE users SET first_name = ?, last_name = ?, display_name = ?, phone = ?, email = ?, profile_image_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(firstName, lastName, `${firstName} ${lastName}`, phone, email, nextImageKey, identity.ownerId, identity.businessId).run();
    } catch (error) {
      if (uploadedImageKey) await authEnv.FILES.delete(uploadedImageKey).catch(() => undefined);
      if (String(error).includes("UNIQUE")) return json({ error: "כבר קיים חשבון עם כתובת המייל הזאת" }, 409);
      throw error;
    }
    if (current?.profileImageKey && current.profileImageKey !== nextImageKey) await authEnv.FILES.delete(current.profileImageKey).catch(() => undefined);
    return json({ updated: true });
  }

  if (action === "changePassword") {
    const identity = await resolveSessionIdentity(authEnv.DB, request);
    if (!identity) return json({ error: "יש להתחבר מחדש" }, 401);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (!validPassword(password)) return json({ error: "הסיסמה החדשה צריכה לכלול לפחות 12 תווים, אות ומספר" }, 400);
    if (password !== confirmPassword) return json({ error: "אימות הסיסמה אינו תואם" }, 400);
    const user = await authEnv.DB.prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ? AND business_id = ?").bind(identity.ownerId, identity.businessId).first<{ passwordHash: string | null }>();
    if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) return json({ error: "הסיסמה הנוכחית אינה נכונה" }, 400);
    if (await verifyPassword(password, user.passwordHash)) return json({ error: "הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית" }, 400);
    await authEnv.DB.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(await hashPassword(password), identity.ownerId, identity.businessId).run();
    const activeToken = sessionToken(request);
    if (activeToken) await authEnv.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token_hash <> ? AND revoked_at IS NULL").bind(identity.ownerId, await sha256(activeToken)).run();
    return json({ updated: true });
  }
  return json({ error: "פעולת האימות אינה תקינה" }, 400);
}
