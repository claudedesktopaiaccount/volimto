import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Set CSRF cookie if not present
  if (!request.cookies.has("pt_csrf")) {
    response.cookies.set("pt_csrf", crypto.randomUUID(), {
      httpOnly: false, // Client JS needs to read this
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all pages except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
