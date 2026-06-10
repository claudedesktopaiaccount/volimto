import { NextRequest, NextResponse } from "next/server";
import { optionalString, readJsonObject } from "@/lib/api/validation";
import { subscribeToNewsletter } from "@/lib/newsletter/subscribe";

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req);
  if (!body.ok) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";

  const result = await subscribeToNewsletter({
    email: String(body.value.email ?? ""),
    source: optionalString(body.value.source) ?? "web",
    ip,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  const status =
    result.error === "invalid_email" ? 400 :
    result.error === "too_many_requests" ? 429 :
    result.error === "already_subscribed" ? 409 :
    500;

  return NextResponse.json({ error: result.error }, { status });
}
