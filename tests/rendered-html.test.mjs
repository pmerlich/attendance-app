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

test("server-renders the Hebrew operations dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/i);
  assert.match(html, /<title>מנהל עבודה \| פרויקטים, שעות וכספים<\/title>/);
  assert.match(html, /כל הפרויקטים/);
  assert.match(html, /יצירת פרויקט/);
  assert.match(html, /הפעילו טיימר ישירות או פתחו פרויקט לפרטים ודיווח ידני/);
  assert.match(html, /aria-label="הפעלת טיימר עבור/);
  assert.match(html, /עדכון מצב הפרויקט/);
  assert.match(html, /הסתיים/);
  assert.match(html, /סה״כ/);
  assert.match(html, /הכנסה צפויה/);
  assert.doesNotMatch(html, /מוכן להתחלה/);
  assert.doesNotMatch(html, /טיימר פעיל/);
  assert.doesNotMatch(html, /class="account-badge"/);
  assert.match(html, /עובד עצמאי/);
  assert.match(html, /סל המחזור/);
  assert.match(html, /דיווחי זמן/);
  assert.match(html, /תשלומים/);
  assert.match(html, /הוצאות וחומרים/);
  assert.ok(html.includes('href="/app-icon.png"'));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /התחלת טיימר/);
  assert.match(page, /running && <button className="mobile-timer running"/);
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
  assert.match(page, /לחיצה על לקוח מציגה את הפרויקטים שלו/);
  assert.match(page, /"sync-icon-button " \+/);
  assert.match(page, /className="sync-popover"/);
  assert.doesNotMatch(page, /className="offline-notice"/);
  assert.match(page, /restoreClient/);
  assert.match(page, /document\.visibilityState === "visible"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /className="skip-link"/);
  assert.match(page, /project-detail-metric-link/);
  assert.match(page, /<span>הוצאות<\/span><strong>€\{Number\(selectedProject\.expenseAmount/);
  assert.match(page, /formatTime\(Number\(entry\.durationSeconds\)\)/);
  assert.match(page, /formatTime\(totalSeconds\)/);
  assert.match(page, /backToProject=\{\(\) => contextProject && selectProject\(contextProject\)\}/);
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
  assert.match(route, /appendAudit/);
  assert.match(route, /loadProjectActivity/);
  assert.match(route, /ORDER BY te\.started_at DESC LIMIT 1000/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /no-store, max-age=0/);
  assert.match(operations, /npm run backup/);
});
test("enables the isolated guest demo only on the preview host", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  assert.match(api, /hostname === "menahel-avoda\.er2829288\.workers\.dev"/);
  assert.match(api, /displayName: "דני לוי"/);
  assert.match(api, /businessId: "guest-demo-business-v1"/);
  assert.match(api, /isGuest: true/);
  assert.match(api, /guest-employee-1/);
  assert.match(api, /guest-project-1/);
  assert.match(api, /guest-payment-1/);
  assert.match(api, /guest-expense-1/);
  assert.ok(api.indexOf("if (userId && email)") < api.indexOf('hostname === "menahel-avoda.er2829288.workers.dev"'));
  assert.doesNotMatch(api, /מצב האורח מיועד לצפייה בלבד/);
  assert.match(page, /מצב אורח — דני לוי/);
  assert.match(page, /סביבת הדגמה ציבורית ומשותפת/);
});
