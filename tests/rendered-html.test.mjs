import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders a neutral account loading screen without demo data", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  const html = await response.text();
  // vinext/@vitejs/plugin-rsc streams Suspense boundary data via inline <script> tags with
  // no src - CSP must allow them (script-src 'unsafe-inline') or streaming breaks outright
  // ("The server could not finish this Suspense boundary... Switched to client rendering").
  // A prior fix pass removed 'unsafe-inline' without verifying this in a real browser and
  // broke exactly that; this count is the actual mechanism, not an assumption.
  assert.ok((html.match(/<script(?:\s[^>]*)?>/gi) ?? []).some((tag) => !/\ssrc=/.test(tag)), "expected at least one inline <script> tag from RSC streaming");
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/i);
  assert.match(html, /<title>מנהל עבודה \| פרויקטים, שעות וכספים<\/title>/);
  assert.match(html, /טוען את החשבון שלך/);
  assert.doesNotMatch(html, /demo-owner|guest-demo|כל הפרויקטים|יצירת פרויקט/);
  assert.ok(html.includes('href="/app-icon.png"'));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /התחלת טיימר/);
  assert.match(page, /running &&\s*\(\s*<button\s+className="mobile-timer running"/);
  assert.doesNotMatch(page, /בחירת פרויקט להפעלת טיימר/);
  assert.match(page, /project-entry-action/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(css.includes(".form-actions .primary-button { display:inline-flex"));
  assert.ok(css.includes("height:100dvh"));
  assert.ok(css.includes("safe-area-inset-bottom"));
  assert.ok(page.includes('https://www.google.com/maps/search/?api=1'));
  assert.doesNotMatch(page, /navigate=yes|dir_action=navigate/);
  assert.ok(page.includes('https://www.waze.com/ul?q='));
  assert.match(page, /function NavigationIcon/);
  assert.match(page, /function WazeIcon/);
  assert.match(page, /function GoogleMapsIcon/);
  assert.doesNotMatch(page, /navigation-chevron/);
  assert.match(page, /updateProjectStatus/);
  assert.match(page, /eventStartedFromControl/);
  assert.match(page, /reflect the action immediately/);
  assert.ok(page.indexOf('applyStoredState(optimistic)') < page.indexOf('await enqueueOperation(operation)'), 'optimistic state must render before queue persistence');
  assert.ok(page.indexOf('await writeCachedState(optimistic)') < page.indexOf('await enqueueOperation(operation)'), 'cached state must be durable before queue completion');
  assert.match(page, /openClientProjects/);
  assert.match(page, /לחיצה על לקוח מציגה את הפרויקטים\s+שלו/);
  assert.match(page, /"sync-icon-button " \+/);
  assert.match(page, /className="sync-popover"/);
  assert.doesNotMatch(page, /className="offline-notice"/);
  assert.match(page, /restoreClient/);
  assert.match(page, /document\.visibilityState === "visible"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /className="skip-link"/);
  assert.match(page, /project-detail-metric-link/);
  assert.match(page, /<span>הוצאות<\/span>\s*<strong>\s*\{formatMoney\(Number\(selectedProject\.expenseAmount/);
  assert.match(page, /formatTime\(Number\(entry\.durationSeconds\)\)/);
  assert.match(page, /formatTime\(totalSeconds\)/);
  assert.match(page, /backToProject=\{\(\) =>\s*contextProject && selectProject\(contextProject\)\s*\}/);
  assert.match(page, /→ חזרה לפרויקט/);
  assert.match(page, /€ תשלום/);
  assert.match(page, /− הוצאה/);
  assert.match(page, /defaultChecked={initial \? Boolean\(initial\.billableToClient\) : true}/);
  assert.match(page, /＋ יצירת לקוח חדש/);
  assert.match(page, /name="duration"/);
  assert.match(page, /className="expense-receipts"/);
  assert.match(page, /className="time-overview"/);
  assert.match(page, /onWheelCapture/);
  assert.match(page, /if \(nextView === "dashboard"\) setSelectedDashboardProjectId\(null\)/);
  assert.match(page, /projectActivity=/);
  assert.match(css, /dashboard-project-card \.project-card-title-row strong \{ font-size:19px/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Starter Project/);
});

test("ships an offline shell and an idempotent operation migration", async () => {
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /searchParams\.get\("v"\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /caches\.match\(request, \{ ignoreSearch:/);
  assert.match(serviceWorker, /matchAll/);
  assert.match(serviceWorker, /\\\/_next\\\//);

  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "מנהל עבודה");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  // P2-10: an explicit maskable icon so Android's adaptive-icon mask doesn't crop the "any" one.
  const maskable = manifest.icons.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable, "manifest must declare a maskable icon");
  assert.equal(maskable.sizes, "512x512");
  const maskablePng = await readFile(new URL(`../public${maskable.src}`, import.meta.url));
  assert.ok(maskablePng.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "maskable icon must be a real PNG");
  assert.equal(maskablePng.readUInt32BE(16), 512, "maskable icon width must actually be 512px");
  assert.equal(maskablePng.readUInt32BE(20), 512, "maskable icon height must actually be 512px");

  const migration = await readFile(new URL("../drizzle/0008_cheerful_sprite.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `offline_operations`/);
  assert.match(migration, /offline_operations_owner_operation_unique/);
});
test("supports employee reports and native Excel export", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const excel = await readFile(new URL("../app/xlsx-export.ts", import.meta.url), "utf8");
  assert.match(page, /כל העובדים — דוח כספי/);
  assert.match(page, /menahel-avoda-report\.xlsx/);
  assert.match(page, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(api, /employeeId !== "all"/);
  assert.match(api, /te\.user_id = \?/);
  assert.match(excel, /0x04034b50/);
  assert.match(excel, /0x02014b50/);
  assert.match(excel, /0x06054b50/);
  assert.match(excel, /xl\/worksheets\/sheet1\.xml/);
});

test("hardens data mutations and production delivery", async () => {
  const route = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const operations = await readFile(new URL("../docs/OPERATIONS.md", import.meta.url), "utf8");
  assert.match(route, /matchesFileSignature/);
  assert.match(route, /הבקשה גדולה מדי/);
  assert.match(route, /יש לעצור את הטיימר הפעיל לפני מחיקת הפרויקט/);
  assert.match(route, /searchParams\.get\("health"\) === "1"/);
  assert.match(route, /auditStatement/);
  assert.match(route, /loadProjectActivity/);
  assert.match(route, /ORDER BY te\.started_at DESC/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /no-store, max-age=0/);
  assert.match(operations, /npm run backup/);
});
test("requires a real account on every public host", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(api, /hostname === "menahel-avoda\.er2829288\.workers\.dev"/);
  assert.match(api, /return null/);
  assert.match(page, /if \(!accountReady\) return <AccountLoadingView/);
  assert.match(page, /if \(authRequired\) return <SignInView/);
  // resolveIdentity() must resolve identity ONLY from the app's own session cookie.
  // A prior revision also trusted client-supplied "oai-authenticated-user-*" headers
  // with no verification they came from a trusted proxy - any direct HTTP client could
  // forge them and obtain, or take over, an account with no password. Never bring this
  // fallback back without a verified trust boundary in front of it.
  assert.doesNotMatch(api, /oai-authenticated-user-id/);
  assert.doesNotMatch(api, /oai-authenticated-user-email/);
  assert.match(api, /async function resolveIdentity\(request: Request\): Promise<Identity \| null> \{\s*return resolveSessionIdentity\(env\.DB, request\);\s*\}/);
});

test("queues attachment blobs for background upload", async () => {
  const store = await readFile(new URL("../app/offline-store.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(store, /DATABASE_VERSION = 2/);
  assert.match(store, /ATTACHMENT_STORE/);
  assert.match(store, /blob: Blob/);
  assert.match(page, /syncQueuedAttachments/);
  assert.match(page, /enqueueAttachment\(queuedAttachment\)/);
});

test("isolates offline data and validates critical mutations", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const offline = await readFile(new URL("../app/offline-store.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(offline, /setOfflineScope/);
  assert.match(offline, /DATABASE_PREFIX.*currentScope/s);
  assert.match(offline, /deleteLegacyUnscopedStore/);
  assert.match(page, /clearOfflineScope\(\)/);
  assert.ok(page.indexOf('const identityResponse = await fetch("/api/state")') < page.indexOf("const [scopedQueue, scopedAttachments]"), "account identity must select the offline scope before its queue is read");
  assert.match(page, /syncRequestedRef\.current = true/);
  assert.match(page, /While online, let the server validate before closing a form/);
  assert.match(page, /removeQueuedOperation\(operation\.id\)/);
  assert.match(page, /onInvalidCapture/);
  assert.match(page, /invalidFieldMessage/);
  assert.match(page, /showFormError\(error, "שמירת הלקוח נכשלה/);
  assert.match(page, /invalidClientField/);
  assert.ok(page.indexOf("if (invalidClientField)") < page.indexOf('await saveAction(editingId ? "updateClient" : "addClient"'), "client validation must run before the request");
  assert.match(page, /role=\{notice\.kind === "error" \? "alert" : "status"\}/);
  assert.match(page, /className="notice-toast-layer"/);
  assert.match(page, /function NoticeToast/);
  assert.match(page, /file\.size > 10 \* 1024 \* 1024/);
  assert.match(page, /rerunRequested.*queueMicrotask/s);
  assert.match(page, /storageScope/);
  assert.match(page, /saveAction\("stopTimer", \{ id:/);
  assert.match(api, /function validCalendarDate/);
  assert.match(api, /WHERE te\.id = \? AND te\.user_id = \?/);
  assert.match(api, /repeated offline replay is successful/);
  assert.match(api, /שם הלקוח חסר או ארוך מ־120 תווים/);
  assert.match(api, /function employeeFieldError/);
  assert.match(api, /עלות השעה של העובד אינה תקינה/);
  assert.match(api, /בתמחור קבוע יש להזין מחיר גדול מאפס/);
  assert.match(api, /בתמחור שעתי יש להזין תעריף גדול מאפס/);
  assert.match(api, /p\.client_id AS clientId/);
  // script-src needs 'unsafe-inline': vinext/@vitejs/plugin-rsc streams Suspense boundary
  // data via inline <script> tags with no src (see the inline-script assertion in the
  // first test above) - removing this breaks RSC streaming, it is not just a hardening
  // gap. Confirmed against the actual rendered output before restoring it (H-01 follow-up).
  assert.match(worker, /script-src 'self' 'unsafe-inline'\$\{developmentScripts\}/);
  assert.match(worker, /url\.hostname === "localhost".*unsafe-eval/);
  assert.match(api, /projectStatements\.push\(auditStatement/);
  assert.match(api, /if \(createsClient\) projectStatements\.push/);
  assert.doesNotMatch(api, /async function appendAudit/);
  assert.match(page, /newClientId: crypto\.randomUUID\(\)/);
  assert.match(page, /operation\.lastError/);
  assert.match(page, /discardRejectedOperations/);
  assert.match(api, /expectedUpdatedAt/);
  assert.match(api, /conflict: \{ entity: "project"/);
  assert.match(api, /function versionConflict/);
  assert.match(page, /expectedUpdatedAt: editingPayment\?\.updatedAt/);
  assert.match(page, /expectedUpdatedAt: editingExpense\?\.updatedAt/);
  assert.match(page, /expectedUpdatedAt: editingClient\?\.updatedAt/);
  assert.match(page, /expectedUpdatedAt: editingEmployee\?\.updatedAt/);
  assert.match(page, /expectedUpdatedAt: editingEntry\?\.updatedAt/);
  assert.match(api, /rawWorkerIds\.length > 100/);
  // H-02: the offline-operation idempotency record must commit in the SAME db.batch() as
  // the mutation it guards, not a separate trailing batch - otherwise a connection drop
  // between the two lets an offline retry with the same operationId double-apply.
  assert.match(api, /const writes: D1PreparedStatement\[\] = \[\];/);
  assert.match(api, /if \(writes\.length\) await db\.batch\(writes\);/);
  assert.doesNotMatch(api, /\]\);\s*\n\s*if \(operationId\) \{\s*\n\s*await db\.batch\(/);
  // M-01: /api/state must reject cross-origin POSTs the same way /api/auth already does.
  assert.match(api, /function sameOrigin\(request: Request\)/);
  assert.match(api, /if \(!sameOrigin\(request\)\) return Response\.json/);
  // M-02: a privacy notice must exist and be reachable from the profile screen.
  const privacyPage = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
  assert.match(privacyPage, /מדיניות פרטיות/);
  assert.match(page, /href="\/privacy\.html"/);
  // P2-09: the placeholder asking the operator to add a real privacy contact must be gone,
  // replaced with an actual one.
  assert.doesNotMatch(privacyPage, /הערה למנהל המערכת/);
  assert.match(privacyPage, /mailto:er2829288@gmail\.com/);
  assert.match(api, /fixedPriceInRange/);
  assert.match(page, /function formatMoney/);
  assert.match(page, /window\.addEventListener\("popstate"/);
  assert.match(page, /BroadcastChannel\("menahel-avoda-state"\)/);
  assert.match(api, /UPDATE attachments SET expense_id = NULL/);
  assert.match(api, /DELETE FROM attachments WHERE id = \?/);
});

test("ships complete queries and performance indexes", async () => {
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0009_performance_indexes.sql", import.meta.url), "utf8");
  assert.doesNotMatch(api, /ORDER BY te\.started_at DESC LIMIT (50|1000)/);
  assert.doesNotMatch(api, /ORDER BY (pay\.paid_at|ex\.incurred_at|a\.created_at|al\.created_at) DESC(?:, [^`]+)? LIMIT (100|1000)/);
  assert.match(api, /let schemaReady: Promise<void> \| null/);
  assert.match(migration, /idx_projects_business_deleted/);
  assert.match(migration, /idx_audit_business_created/);
});

test("uses minor currency units and recomputes offline summaries", async () => {
  const route = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0011_money_minor_units.sql", import.meta.url), "utf8");
  assert.match(route, /moneyToCents/);
  assert.match(route, /amount_cents/);
  assert.match(route, /fixed_price_cents/);
  assert.match(migration, /ROUND\(`amount` \* 100\)/);
  assert.match(page, /next\.projects = next\.projects\.map/);
  assert.match(page, /billableExpenseAmount/);
  assert.match(page, /RecordListFilters/);
});

test("ships persistent isolated account authentication", async () => {
  const auth = await readFile(new URL("../app/auth-core.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8");
  const state = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0012_real_accounts.sql", import.meta.url), "utf8");
  assert.match(auth, /PBKDF2_ITERATIONS = 100_000/);
  assert.match(auth, /iterations > 100_000/);
  assert.match(route, /contactFieldError/);
  assert.match(auth, /HttpOnly; SameSite=Lax; Secure; Max-Age=/);
  assert.match(auth, /expires_at = datetime\('now', \?\)/);
  assert.match(auth, /token_hash/);
  assert.match(route, /action === "register"/);
  assert.match(route, /action === "login"/);
  assert.match(route, /action === "logout"/);
  assert.match(route, /validImageSignature/);
  assert.match(route, /COUNT\(\*\) AS count FROM auth_login_attempts/);
  assert.match(route, /action === "updateProfile"/);
  assert.match(route, /action === "changePassword"/);
  assert.match(route, /token_hash <> \?/);
  assert.match(route, /declaredLength > 6 \* 1024 \* 1024/);
  assert.match(page, /className="profile-edit-button"/);
  assert.match(page, /editingProfile &&/);
  assert.match(page, /aria-controls="profile-account-editor"/);
  assert.match(page, /updateViaCache: "none"/);
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /url\.searchParams\.has\("_rsc"\)/);
  assert.match(serviceWorker, /includes\("text\/x-component"\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.match(state, /resolveSessionIdentity/);
  assert.match(migration, /CREATE TABLE `auth_sessions`/);
  // L-02: 12-character password minimum, but never enforced on the login field itself -
  // existing accounts may still have a shorter password already set, and login never
  // calls validPassword() at all.
  assert.match(route, /value\.length >= 12 && value\.length <= 128/);
  assert.match(page, /minLength=\{mode === "register" \? 12 : undefined\}/);
});

test("selects an existing client by id, keeps the timer display isolated from browsing, and offers a permanent trash purge", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Project creation must resolve the picked client by id, not by re-deriving it from the
  // select's DOM index against a separately-sorted array (that mismatch silently produced an
  // empty clientId/clientName for any existing-client pick).
  assert.match(page, /option key=\{client\.id\} value=\{String\(client\.id\)\}/);
  assert.match(page, /const clientId = String\(data\.get\("client"\) \?\? ""\)/);
  assert.match(page, /const selectedClient = clients\.find\(\(client\) => String\(client\.id\) === clientId\)/);
  // newClientName is "" (not null) when absent, so the clientName fallback must check truthiness
  // (||), not nullishness (??) - that mismatch made every existing-client project rejected.
  assert.match(api, /const clientName = newClientName \|\| boundedText\(body\.clientName, 120, true\)/);

  // Viewing/selecting a project must never reassign activeProject while a timer is running on a
  // different project - activeProject drives the timer widget and the per-card "is this the
  // running timer" badge, so reassigning it made browsing look like the timer had moved.
  assert.match(page, /if \(!running\) setActiveProject\(project\)/);
  assert.match(page, /selectedProjectId !== null \? projects\.find\(\(project\) => String\(project\.id\) === String\(selectedProjectId\)\) \?\? null : null/);
  assert.match(page, /const timerDisabled = project\.tag === "הסתיים" \|\| \(running && !isTimerProject\)/);

  // Recycle bin: permanent delete alongside restore, for clients, projects and employees.
  assert.match(api, /action === "purgeProject"/);
  assert.match(api, /action === "purgeClient"/);
  assert.match(api, /action === "purgeEmployee"/);
  assert.match(api, /async function purgeProjectCascade/);
  assert.match(api, /hasTimeHistory/);
  assert.match(page, /function purgeRecord/);
  assert.match(page, /className="purge-button"/);
  assert.match(page, /אינה הפיכה ולא ניתן יהיה לשחזר/);

  // Profile picture replaces the initial-letter avatar in both the desktop sidebar and topbar.
  assert.match(page, /currentUser\.profileImageUrl \? <Image src=\{currentUser\.profileImageUrl\}/);
  assert.match(css, /\.user-avatar img, \.profile-button img/);

  // Every submit button under .auth-form must carry an explicit style class - a bare <button> in
  // this codebase renders with no background or border at all.
  assert.match(page, /<button type="submit" className="primary-button" disabled=\{submitting\}/);
  assert.match(page, /<button type="submit" className="primary-button" disabled=\{profileSaving\}/);
  assert.match(page, /<button type="submit" className="primary-button" disabled=\{passwordSaving\}/);

  // Mobile filter row: a bare `1fr` grid track won't shrink below a date input's intrinsic
  // width, which pushed the row off-screen - it must be minmax(0, 1fr).
  assert.match(css, /\.record-list-filters \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \}/);
});

test("P2-01: account-mode and billing-type radio pickers stay keyboard-focusable", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // `display: none` removes an <input> from both the accessibility tree and the tab order,
  // trapping keyboard/screen-reader users on these two required, unavoidable form controls.
  // The real input must stay in the tab order (visually-hidden-but-focusable), with a visible
  // focus ring on the label for sighted keyboard users.
  assert.doesNotMatch(css, /\.billing-options input \{ display: none; \}/);
  assert.doesNotMatch(css, /\.account-mode-options label input \{ display: none; \}/);
  assert.match(css, /\.billing-options input \{ position: absolute; width: 1px; height: 1px;/);
  assert.match(css, /\.account-mode-options label input \{ position: absolute; width: 1px; height: 1px;/);
  assert.match(css, /\.billing-options label:focus-within \{/);
  assert.match(css, /\.account-mode-options label:focus-within \{/);
});

test("P2-03/P2-04: docs match shipped offline-attachment behavior, and small badges/buttons meet WCAG AA contrast", async () => {
  const decisions = await readFile(new URL("../docs/DECISIONS.md", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // D-027 previously said file upload/deletion both require connectivity - contradicting the
  // actual code, where uploadAttachment() queues offline like any other core action.
  assert.doesNotMatch(decisions, /העלאת או מחיקת קבצים ויצירת קישור הזמנה לעובד דורשות חיבור לאינטרנט/);
  assert.match(decisions, /P2-03/);
  // Amber-600 on amber-light (~2.86:1) and white on --green at 11-12px/bold (~3.77:1) both fell
  // short of WCAG AA's 4.5:1 for this text size; reused colors already proven readable elsewhere
  // in this file instead of introducing new ones.
  assert.doesNotMatch(css, /\.connection-pill\.pending \{ background: var\(--amber-light\); color: var\(--amber\); \}/);
  assert.match(css, /\.connection-pill\.pending \{ background: var\(--amber-light\); color: #92400e; \}/);
  assert.doesNotMatch(css, /\.invite-button \{[^}]*background: var\(--green\);/);
  assert.doesNotMatch(css, /\.sync-popover button \{[^}]*background: var\(--green\);/);
});

test("P2-15: session cookie uses the __Host- prefix without force-logging-out existing sessions", async () => {
  const auth = await readFile(new URL("../app/auth-core.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8");
  // __Host- is a browser-enforced contract: the browser itself rejects the cookie if Secure,
  // no-Domain or Path=/ are ever violated, instead of trusting the server to always set them
  // right. It requires Secure unconditionally, not just on HTTPS.
  assert.match(auth, /const SESSION_COOKIE = "__Host-menahel_session";/);
  assert.match(auth, /const LEGACY_SESSION_COOKIE = "menahel_session";/);
  assert.match(auth, /Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=\$\{SESSION_DAYS \* 86400\}`;/);
  // A naive rename would force-log-out every currently-authenticated user on deploy (their
  // browser still only holds the old-named cookie). sessionToken() must keep accepting the
  // legacy name for a transition period; sessionCookie() (writing) must only ever use the new
  // one, so already-logged-in users get silently migrated to it on their next request.
  assert.match(auth, /if \(name === LEGACY_SESSION_COOKIE\) legacyToken = decodeURIComponent/);
  assert.match(auth, /return legacyToken;/);
  assert.doesNotMatch(auth, /sessionCookie\(token: string, request: Request\)/);
  // Logout must clear both names - a lingering pre-rename cookie the browser hasn't overwritten
  // yet would otherwise survive an explicit logout.
  assert.match(auth, /export function clearSessionCookie\(request: Request\) \{/);
  assert.match(auth, /return \[\s*`\$\{SESSION_COOKIE\}=; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,\s*`\$\{LEGACY_SESSION_COOKIE\}=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/);
  // json()'s cookie param must accept the array clearSessionCookie() now returns, appending
  // one set-cookie header per value (Headers.append, not a single overwritten header).
  assert.match(route, /function json\(body: unknown, status = 200, cookie\?: string \| string\[\]\)/);
  assert.match(route, /headers\.append\("set-cookie", value\)/);
});

test("P2-06: restore script exists and refuses a remote restore without explicit double confirmation", async () => {
  const restore = await readFile(new URL("../scripts/restore.ps1", import.meta.url), "utf8");
  assert.match(restore, /\[switch\]\$Remote/);
  assert.match(restore, /\[switch\]\$Confirm/);
  // A single mistyped/forgotten flag must not be enough to restore into production - both
  // -Remote and -Confirm are required together (verified in this session by actually running
  // the script: -Remote alone was rejected before any network call, and a full restore into an
  // isolated scratch D1 - never production, never the developer's own local dev database -
  // succeeded and was spot-checked by reading the restored row back; see docs/OPERATIONS.md).
  assert.match(restore, /if \(\$Remote -and -not \$Confirm\) \{\s*throw "Refusing to restore into the REMOTE/);
  assert.match(restore, /if \(-not \(Test-Path -LiteralPath \$resolvedBackup\)\) \{ throw "Backup file not found/);
  assert.match(restore, /if \(\$item\.Length -eq 0\) \{ throw "Backup file is empty/);
  const operations = await readFile(new URL("../docs/OPERATIONS.md", import.meta.url), "utf8");
  assert.match(operations, /scripts\/restore\.ps1/);
  assert.match(operations, /תרגיל שחזור שבוצע/);
});

test("P2-11/P2-12/P2-13/P2-14/P2-16: low-severity hardening and polish findings", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const authRoute = await readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8");
  const dependabot = await readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8");

  // P2-16: defense-in-depth response headers, no functional impact expected for this app.
  assert.match(worker, /headers\.set\("cross-origin-opener-policy", "same-origin"\)/);
  assert.match(worker, /headers\.set\("cross-origin-resource-policy", "same-site"\)/);

  // P2-11: the browser-chrome theme color (viewport.themeColor) must match the installed-PWA
  // splash/status-bar color (manifest theme_color) - they used to disagree (blue vs green).
  assert.match(layout, /themeColor: "#1e7a59"/);
  assert.equal(manifest.theme_color, "#1e7a59");
  // Dead CSS with zero usage in app/page.tsx (confirmed by grep before removal).
  assert.doesNotMatch(css, /@keyframes pulseGreen/);
  assert.doesNotMatch(css, /\.connection \{ color: var\(--muted\)/);

  // P2-12: Dependabot PRs get the same npm run check gate as a human PR (see ci.yml).
  assert.match(dependabot, /package-ecosystem: "npm"/);
  assert.match(dependabot, /interval: "weekly"/);

  // P2-13: a small fixed floor on the "account not found" branch of requestPasswordReset
  // narrows (does not eliminate) the timing gap versus the "account exists" branch, which does
  // strictly more work (a db.batch() write plus an outbound Resend call) before responding.
  assert.match(authRoute, /\} else \{[\s\S]{0,800}setTimeout\(resolve, 200\)/);

  // P2-14: auth_tokens must not grow unbounded like offline_operations would without its own
  // prune - piggybacked on the same db.batch() the reset-request flow already writes to.
  assert.match(authRoute, /DELETE FROM auth_tokens WHERE user_id = \? AND \(used_at IS NOT NULL OR expires_at < CURRENT_TIMESTAMP\)/);
});

test("P2-07: unhandled Worker errors are caught, logged, and answered with security headers", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  // Before this fix there was no top-level catch at all - an exception from handler.fetch()
  // (any page render or API route) propagated straight to the Workers runtime with zero
  // application-level log line, and skipped secureResponse()'s headers on the error response.
  assert.match(worker, /} catch \(error\) \{[\s\S]*?console\.error\(`\[worker\] unhandled error on \$\{request\.method\} \$\{url\.pathname\}:`/);
  assert.match(worker, /response = new Response\("Internal Server Error", \{ status: 500 \}\);/);
  assert.ok(worker.indexOf("} catch (error) {") < worker.indexOf("return secureResponse(response, url, request);"), "the error response must still pass through secureResponse()");
});

test("P2-02: rejected offline operations stay queued with a reason instead of vanishing", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  // A non-retryable 4xx (e.g. a 409 version conflict) during offline-queue replay must keep the
  // operation queued with the server's message so the existing retry/discard UI can surface it,
  // instead of calling removeQueuedOperation() and quietly losing the user's change.
  assert.doesNotMatch(page, /Remove legacy invalid data\s*\/\/ instead of presenting it forever as a connectivity\/sync failure\.\s*await removeQueuedOperation\(operation\.id\);/);
  assert.match(page, /const payload = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\) as \{ error\?: string \};\s*const message = payload\.error \|\| "הפעולה נדחתה על ידי השרת";\s*await enqueueOperation\(\{ \.\.\.operation, lastError: message \}\);\s*setSyncError\(message\);/);
  // Automatic sync passes must not resend an already-rejected operation (that cannot succeed
  // and would otherwise retry forever via the continueSync self-reschedule below), and must stop
  // applying its optimistic effect to the displayed state once it's known to have been rejected.
  assert.match(page, /const pendingOperations = operations\.filter\(\(operation\) => !operation\.lastError\);/);
  assert.match(page, /const remainingPending = remaining\.filter\(\(operation\) => !operation\.lastError\);/);
  assert.match(page, /if \(remainingPending\.length\) \{/);
});
