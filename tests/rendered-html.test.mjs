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
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/i);
  assert.match(html, /<title>מנהל עבודה \| פרויקטים, שעות וכספים<\/title>/);
  assert.match(html, /מוכן להתחלה/);
  assert.match(html, /דיווח ידני/);
  assert.match(html, /שעות שנשמרו/);
  assert.match(html, /פרויקטים פעילים/);
  assert.match(html, /מצב עובד/);
  assert.match(html, /עובד עצמאי/);
  assert.match(html, /עריכה/);
  assert.match(html, /לסל/);
  assert.match(html, /סל המחזור/);
  assert.match(html, /דיווחי זמן/);
  assert.match(html, /תשלומים/);
  assert.match(html, /הוצאות וחומרים/);
  assert.match(html, /href="\/app-icon\.png"/);
  assert.match(html, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
  assert.match(html, /https:\/\/www\.waze\.com\/ul\?q=/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Starter Project/);
});

test("ships an offline shell and an idempotent operation migration", async () => {
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /caches\.match\(request\)/);

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