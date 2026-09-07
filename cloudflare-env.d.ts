interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  // Optional: unset in local dev and before the operator configures Resend in production.
  // See app/email.ts and docs/AUTH_ACCOUNTS.md.
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ASSETS: Fetcher;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  }
}
