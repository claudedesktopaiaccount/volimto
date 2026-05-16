import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const db = getDb();

  const sessionToken = req.cookies.get("volimto_session")?.value;
  if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await validateSession(sessionToken, db);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId));

  const siteUrl = "https://volimto.sk";

  // Create Stripe Checkout session via REST.
  const params = new URLSearchParams({
    "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    success_url: `${siteUrl}/api-pristup?upgraded=1`,
    cancel_url: `${siteUrl}/api-pristup`,
    customer_email: user.email,
    "metadata[userId]": session.userId,
    "subscription_data[metadata][userId]": session.userId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "Stripe error", detail: err }, { status: 500 });
  }

  const checkout = await res.json() as { url: string };
  return NextResponse.json({ url: checkout.url });
}
