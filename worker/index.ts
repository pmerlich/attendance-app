/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { sessionCookie, sessionToken } from "../app/auth-core";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

function secureResponse(response: Response, url: URL, request: Request) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(self), geolocation=(), microphone=()");
  // Defense-in-depth, no expected functional impact: this app never embeds cross-origin
  // resources itself, and no legitimate page embeds it either. Waze/Google Maps links use
  // target="_blank" navigation to a different origin (unaffected by isolating our own
  // browsing context group), and /_vinext/image is a same-origin request.
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-site");
  const developmentScripts = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? " 'unsafe-eval'" : "";
  // script-src needs 'unsafe-inline': vinext/@vitejs/plugin-rsc streams Suspense boundary
  // data to the client via inline <script> tags (confirmed by rendering the built worker -
  // the response HTML contains ~18 of them with no src). Blocking them does not just
  // weaken defense-in-depth, it breaks RSC streaming outright ("The server could not
  // finish this Suspense boundary... Switched to client rendering"), which is exactly
  // what commit d9c0e01 ("fix: prevent stale RSC suspense failures") was fixing when it
  // added this back. A prior revision removed 'unsafe-inline' here (see
  // docs/SOLO_WORKER_AUDIT.md S-27) without catching this - do not remove it again without
  // first switching the framework's inline scripts to a nonce/hash-based CSP source and
  // verifying Suspense/streaming still works in a real browser.
  headers.set("content-security-policy", `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'${developmentScripts}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' ws: wss:`);
  if (url.protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  if (url.pathname.startsWith("/api/")) headers.set("cache-control", "no-store, max-age=0");
  const activeSession = sessionToken(request);
  if (activeSession && url.pathname === "/api/state" && response.status < 400) headers.append("set-cookie", sessionCookie(activeSession));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;

    try {
      if (url.pathname === "/_vinext/image") {
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        response = await handleImageOptimization(request, {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          },
        }, allowedWidths);
      } else {
        response = await handler.fetch(request, env, ctx);
      }
    } catch (error) {
      // A single top-level boundary for every unhandled exception (page render, API route, or
      // image optimization) - without this, an error inside handler.fetch() propagated straight
      // to the Workers runtime with no application-level record. Log only enough to locate the
      // failure - never the request body, cookies, or Authorization header.
      console.error(`[worker] unhandled error on ${request.method} ${url.pathname}:`, error instanceof Error ? error.message : String(error));
      response = new Response("Internal Server Error", { status: 500 });
    }

    return secureResponse(response, url, request);
  },
};

export default worker;
