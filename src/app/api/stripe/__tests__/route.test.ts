import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkoutPost } from "../checkout/route";
import { POST as webhookPost } from "../webhook/route";

const mocks = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[],
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.selectRows),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };

  return {
    db,
    state,
    getDb: vi.fn(() => db),
    validateSession: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: mocks.validateSession,
}));

async function stripeSignature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

function checkoutRequest() {
  return new NextRequest("https://volimto.test/api/stripe/checkout", {
    method: "POST",
    headers: {
      cookie: "volimto_session=session-token",
    },
  });
}

async function webhookRequest(body: string, signature: string) {
  return new NextRequest("https://volimto.test/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": signature,
    },
    body,
  });
}

describe("stripe checkout route", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_secret";
    process.env.STRIPE_PRICE_ID = "price_test";
    process.env.NEXT_PUBLIC_SITE_URL = "https://volimto.test";
    mocks.state.selectRows = [{ email: "user@example.com" }];
    mocks.getDb.mockClear();
    mocks.validateSession.mockReset();
    mocks.validateSession.mockResolvedValue({ userId: "user-1" });
    mocks.db.select.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects unauthenticated checkout requests before database access", async () => {
    const response = await checkoutPost(
      new NextRequest("https://volimto.test/api/stripe/checkout", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mocks.getDb).toHaveBeenCalledOnce();
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });

  it("returns a safe error when checkout config is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await checkoutPost(checkoutRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Checkout is not configured" });
    expect(JSON.stringify(body)).not.toContain("sk_");

    consoleError.mockRestore();
  });

  it("does not leak raw Stripe provider errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue(
      new Response("provider secret sk_test_secret", { status: 400 })
    );

    const response = await checkoutPost(checkoutRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Stripe error" });
    expect(JSON.stringify(body)).not.toContain("provider secret");

    consoleError.mockRestore();
  });
});

describe("stripe webhook route", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mocks.state.selectRows = [
      { id: "key-newer", revokedAt: null, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "key-older", revokedAt: null, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    mocks.getDb.mockClear();
    mocks.db.select.mockClear();
    mocks.db.update.mockClear();
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await webhookPost(await webhookRequest("{}", ""));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Webhook not configured");
    expect(mocks.getDb).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("rejects malformed, invalid, and old signatures before database access", async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 301;
    const oldSignature = await stripeSignature("{}", "whsec_test", oldTimestamp);

    for (const signature of ["not-a-signature", "t=123,v1=not-hex", oldSignature]) {
      const response = await webhookPost(await webhookRequest("{}", signature));
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Invalid signature");
    }

    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("updates the newest active API key on checkout completion", async () => {
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-1" },
          subscription: "sub_123",
        },
      },
    });
    const signature = await stripeSignature(body, "whsec_test");

    const response = await webhookPost(await webhookRequest(body, signature));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(mocks.db.update).toHaveBeenCalledOnce();
  });

  it("rejects invalid JSON with a valid signature", async () => {
    const signature = await stripeSignature("{", "whsec_test");

    const response = await webhookPost(await webhookRequest("{", signature));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid payload");
  });
});
