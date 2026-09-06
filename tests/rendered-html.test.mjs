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
  const html = await response.text();
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
  assert.match(serviceWorker, /caches\.match\(request\)/);
  assert.match(serviceWorker, /matchAll/);
  assert.match(serviceWorker, /\\\/_next\\\//);

  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "מנהל עבודה");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");

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
  assert.match(page, /storageScope/);
  assert.match(page, /saveAction\("stopTimer", \{ id:/);
  assert.match(api, /function validCalendarDate/);
  assert.match(api, /WHERE te\.id = \? AND te\.user_id = \?/);
  assert.match(api, /p\.client_id AS clientId/);
  assert.doesNotMatch(worker, /script-src 'self' 'unsafe-inline'/);
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
  assert.match(auth, /PBKDF2_ITERATIONS = 310_000/);
  assert.match(auth, /HttpOnly; SameSite=Lax; Max-Age=/);
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
  assert.match(state, /resolveSessionIdentity/);
  assert.match(migration, /CREATE TABLE `auth_sessions`/);
});
