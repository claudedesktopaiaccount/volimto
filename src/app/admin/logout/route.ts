import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/prihlasenie", req.nextUrl.origin));
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSession(token, getDb());
  }

  const res = NextResponse.redirect(new URL("/prihlasenie", req.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  res.cookies.delete("admin_session");
  res.cookies.delete("admin_sig");
  return res;
}
