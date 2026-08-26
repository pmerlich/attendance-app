import assert from "node:assert/strict";
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
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Starter Project/);
});
