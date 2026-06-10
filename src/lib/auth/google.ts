import { timingSafeEqual } from "@/lib/hash";

export const GOOGLE_OAUTH_STATE_COOKIE = "volimto_google_oauth_state";
export const GOOGLE_OAUTH_NEXT_COOKIE = "volimto_google_oauth_next";
const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60;

export function safeAuthNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/profil";
  return next;
}

function getGoogleAllowedEmails(): string[] {
  return (process.env.GOOGLE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isGoogleEmailAllowed(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const allowedEmails = getGoogleAllowedEmails();
  for (const allowedEmail of allowedEmails) {
    if (await timingSafeEqual(normalizedEmail, allowedEmail)) return true;
  }
  return false;
}

export function googleOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
    path: "/",
  };
}
