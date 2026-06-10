import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiKeys } from "@/lib/db/schema";

function parseStripeSignature(signature: string): { timestamp?: string; v1?: string } {
  const parts: { timestamp?: string; v1?: string } = {};
  for (const rawPart of signature.split(",")) {
    const [key, value] = rawPart.split("=");
    if (key === "t") parts.timestamp = value;
    if (key === "v1") parts.v1 = value;
  }
  return parts;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const { timestamp, v1 } = parseStripeSignature(signature);
  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = new Uint8Array(sig);

  // Decode v1 hex to bytes for timing-safe comparison
  const v1Bytes = hexToBytes(v1);
  if (!v1Bytes) return false;
  if (expected.length !== v1Bytes.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ v1Bytes[i];
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook configuration is missing.");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }
  const db = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = (session["metadata"] as Record<string, string>)?.["userId"];
    const subscriptionId = session["subscription"] as string;
    if (userId && subscriptionId) {
      const keys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      const active = keys.filter((k) => !k.revokedAt).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      if (active.length > 0) {
        await db
          .update(apiKeys)
          .set({ tier: "paid", stripeSubscriptionId: subscriptionId })
          .where(eq(apiKeys.id, active[0].id));
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const subscriptionId = sub["id"] as string;
    await db
      .update(apiKeys)
      .set({ tier: "free" })
      .where(eq(apiKeys.stripeSubscriptionId, subscriptionId));
  }

  return new NextResponse("ok", { status: 200 });
}
