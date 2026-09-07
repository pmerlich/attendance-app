# Remediation Checklist — audit findings from AUDIT_REPORT_EN.md / AUDIT_REPORT_HE.md

Branch: `fix/audit-remediation-2026-09` (created from `fix/sync-replay-validation`).
**Do NOT deploy to production (`npm run deploy` / `wrangler deploy`) until the user explicitly says so.**

Legend: `[ ]` pending · `[~]` in progress · `[x]` done and verified · `[-]` deliberately skipped/deferred (reason noted).

## CRITICAL

- [x] **C-01** — Removed the `oai-authenticated-*` trusted-header identity fallback in `app/api/state/route.ts` `resolveIdentity()`; now resolves exclusively via `resolveSessionIdentity()` (cookie). Extended `tests/rendered-html.test.mjs`'s "requires a real account on every public host" test to assert the header names and the old fallback branch are gone from the source. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓.

## HIGH

- [x] **H-01 — REVISED, do not remove `'unsafe-inline'` again.** Original fix removed it from `script-src`; after deploying locally the user hit a real error ("The server could not finish this Suspense boundary... Switched to client rendering"). Investigated by rendering the actual built Worker output: it contains **~18 inline `<script>` tags with no `src`**, which is how `vinext`/`@vitejs/plugin-rsc` streams Suspense boundary data to the client. Blocking them (as I did) doesn't just weaken defense-in-depth, it breaks RSC streaming outright — this is almost certainly exactly what commit `d9c0e01` ("fix: prevent stale RSC suspense failures") was restoring when it re-added `'unsafe-inline'`. **I was wrong to call that a careless regression in the audit without testing it in a real browser first; reverted.** `worker/index.ts` now keeps `'unsafe-inline'` in `script-src` with a comment explaining why, and the tests assert an inline script is actually present rather than asserting `'unsafe-inline'` is absent. A proper fix (nonce/hash-based CSP for just those framework-emitted scripts) is a real follow-up but out of scope here — do not attempt it without verifying Suspense/streaming in an actual browser afterward. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓, and manually confirmed the live-rendered CSP header contains `'unsafe-inline'` again.
- [x] **H-02** — Converted every mutation branch in `POST()` to push its statements onto one shared `writes` array instead of calling `db.batch()` immediately; the offline-operation idempotency INSERT/cleanup DELETE are pushed onto the same array, and a single `db.batch(writes)` commits everything (mutation + audit + idempotency record) atomically at the end. Added a regression test pinning this shape. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓.

## MEDIUM

- [x] **M-01** — Added the same `sameOrigin(request)` check used in `app/api/auth/route.ts` to the very top of `app/api/state/route.ts`'s `POST()` (before both the JSON and multipart/attachment-upload paths). Added a regression test. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓.
- [x] **M-02** — Added `public/privacy.html` (Hebrew, RTL, static, `noindex`) describing what's collected, why, where it's stored, and how to request access/correction/deletion. Linked from the Profile screen for both manager and employee accounts (`.privacy-link` in `app/page.tsx` + `app/globals.css`). **Note for the user:** the page has a placeholder asking the account owner to add a real contact email/phone for privacy requests — fill that in before relying on it. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓.
- [x] **M-03** — Added `.github/workflows/ci.yml` (GitHub Actions): Node 22.13.0, `npm ci`, then `npm run check` (typecheck + lint + build + test) on every push and PR. Not runnable/verifiable locally (no GitHub Actions runner here) — will start running automatically once this branch/PR is pushed to GitHub.
- [x] **M-04** (partial, by design) — Ran `npm audit fix` (no `--force`): 22 → 14 vulnerabilities, `package.json` unchanged (only `package-lock.json` resolved versions within existing ranges). Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓. The remaining 14 all require major-version bumps (`vite`, `wrangler`/`@cloudflare/vite-plugin`, `drizzle-kit`, `vinext`, `react-server-dom-webpack`) — per the audit report these are devDependencies only (not shipped in the deployed Worker bundle) and need deliberate, separately-tested upgrades given this project's unusual `vinext`/RSC/Cloudflare toolchain; **not done in this pass**, left as a tracked follow-up.
- [x] **M-05** (needs your action to be live) — Added `.github/workflows/backup.yml`: daily (02:00 UTC) `wrangler d1 export`, uploaded as a 90-day GitHub Actions artifact, plus a manual `workflow_dispatch` trigger for test restores. Documented in `docs/OPERATIONS.md`. **This will not actually run successfully until you add two repo secrets** (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (D1 read/export permission) and `CLOUDFLARE_ACCOUNT_ID` — the job fails fast with a clear message if they're missing, rather than silently no-op'ing. I cannot create these secrets myself. A test restore into a non-production D1 is still not done (destructive/production-adjacent, needs your go-ahead).

## LOW

- [-] **L-01** — Checked before implementing: `app/globals.css` has 60+ hardcoded white/light `background:` declarations out of 256 total (cards, modals, inputs, etc. use literal `white`/`#fff`, not a `--surface` variable). A correct dark mode needs a systematic pass over most of those, which is real design work with real regression risk across the whole app, not the "low-risk additive" change I'd assumed - and the audit itself framed this as optional/cosmetic, only worth doing "if user demand justifies the effort." Deferred rather than ship a half dark mode (e.g. white cards on a dark page). Say the word if you want it done properly as its own pass.
- [x] **L-02** — Raised minimum password length from 10 to 12 in `validPassword()` (`app/api/auth/route.ts`) and matching client-side hints/error text in `app/page.tsx` — carefully left the **login** password field's `minLength` unset so existing accounts with a shorter password already set can still log in (only registration and choosing a new password now require 12+). Confirmed with the user that login never enforces a minimum length server-side either. Verified: typecheck ✓, lint ✓, build ✓, 11/11 tests ✓.
- [-] **L-03** — Session lifetime (365-day rolling cookie). Deliberate, documented product decision (`docs/AUTH_ACCOUNTS.md`) — no change unless the user asks for one.
- [-] **L-04** — `app/page.tsx` / `app/api/state/route.ts` file size. Explicitly "not automatically a defect" per the audit; a large unrequested refactor of a working, tested file carries its own regression risk — deferred.
- [-] **L-05** — Forward-only migrations (no `DOWN` scripts). No architectural change recommended by the audit itself; covered by M-05 (backup) instead.
- [x] **L-06** — Added a dated addendum at the top of `docs/STATUS.md` (2026-09-07) explicitly flagging that the later "guest mode" / "no login" entries below it are superseded, and pointing to `docs/AUTH_ACCOUNTS.md` as the current source of truth for the auth model.
- [x] **L-07** — Removed `app/chatgpt-auth.ts` (dead code, bundled with C-01). Verified nothing referenced it (typecheck/build clean).

## Verification after each group

After each checked-off item (or small group of related items): `npm run typecheck && npm run lint && npm test`, then `git diff` review before moving on.

## Final step (only on explicit user instruction)

- [ ] User has explicitly approved deployment.
- [ ] `npm run deploy` executed.

---
Started: 2026-09-07.
