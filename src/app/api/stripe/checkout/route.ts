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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID;
  if (!stripeSecretKey || !stripePriceId) {
    console.error("Stripe checkout configuration is missing.");
    return NextResponse.json({ error: "Checkout is not configured" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://volimto.sk";

  // Create Stripe Checkout session via REST.
  const params = new URLSearchParams({
    "line_items[0][price]": stripePriceId,
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
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Stripe checkout session failed:", detail);
    return NextResponse.json({ error: "Stripe error" }, { status: 502 });
  }

  const checkout = await res.json() as { url: string };
  return NextResponse.json({ url: checkout.url });
}
