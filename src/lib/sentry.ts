import { Toucan } from "toucan-js";

interface SentryEnv {
  SENTRY_DSN?: string;
}

/**
 * Create a Toucan (Sentry) instance for route handlers.
 * Returns null if SENTRY_DSN is not configured.
 */
export function createSentry(request: Request, env: SentryEnv): Toucan | null {
  if (!env.SENTRY_DSN) return null;

  return new Toucan({
    dsn: env.SENTRY_DSN,
    request,
  });
}

/**
 * Create a Toucan instance without a request (for server components).
 */
export function createSentryWithoutRequest(env: SentryEnv): Toucan | null {
  if (!env.SENTRY_DSN) return null;

  return new Toucan({
    dsn: env.SENTRY_DSN,
  });
}

/**
 * Safely capture an exception with Sentry.
 * No-ops if sentry is null (DSN not configured).
 */
export function captureException(sentry: Toucan | null, error: unknown): void {
  if (!sentry) return;
  sentry.captureException(error);
}
