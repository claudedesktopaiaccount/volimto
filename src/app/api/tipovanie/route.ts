import { NextRequest, NextResponse } from "next/server";
import { getDb, type Database } from "@/lib/db";
import { parties, userPredictions, crowdAggregates, rateLimits } from "@/lib/db/schema";
import { eq, or, count, sql, lt, and, gte } from "drizzle-orm";
import { seedParties } from "@/lib/db/seed";
import { PARTY_LIST } from "@/lib/parties";
import { hashString, timingSafeEqual } from "@/lib/hash";
import { createSentry, captureException } from "@/lib/sentry";
import { validateSession, SESSION_COOKIE } from "@/lib/auth/session";

const VALID_PARTY_IDS = new Set(PARTY_LIST.map((p) => p.id));

const RATE_LIMIT = 10;
const RATE_WINDOW_S = 60;

async function isRateLimited(db: Database, ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RATE_WINDOW_S;
  const ipHash = await hashString(ip);

  // Check count before inserting — don't record rate-limited requests
  const result = await db
    .select({ c: count() })
    .from(rateLimits)
    .where(and(eq(rateLimits.ipHash, ipHash), gte(rateLimits.createdAt, cutoff)));

  if (result[0].c >= RATE_LIMIT) return true;

  // Under limit — record this request
  await db.insert(rateLimits).values({ ipHash, createdAt: now });

  // Clean up old entries (best-effort)
  await db.delete(rateLimits).where(lt(rateLimits.createdAt, cutoff));

  return false;
}

async function ensureSeeded(db: Database) {
  const result = await db.select({ c: count() }).from(parties);
  if (result[0].c === 0) {
    await seedParties(db);
  }
}

export async function POST(request: NextRequest) {
  try {
    // CSRF validation: double-submit cookie pattern (timing-safe)
    const csrfCookie = request.cookies.get("pt_csrf")?.value;
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || !(await timingSafeEqual(csrfCookie, csrfHeader))) {
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const body = (await request.json()) as {
      selectedWinner: string;
      fingerprint?: string;
      predictedPercentages?: Record<string, number>;
      coalitionPick?: string[];
    };
    const { selectedWinner, fingerprint, predictedPercentages, coalitionPick } = body;

    if (!selectedWinner || typeof selectedWinner !== "string" || !VALID_PARTY_IDS.has(selectedWinner)) {
      return NextResponse.json({ error: "Invalid party" }, { status: 400 });
    }

    if (fingerprint && (typeof fingerprint !== "string" || fingerprint.length > 128)) {
      return NextResponse.json({ error: "Invalid fingerprint" }, { status: 400 });
    }

    // Validate optional percentage predictions
    if (predictedPercentages) {
      for (const [partyId, pct] of Object.entries(predictedPercentages)) {
        if (!VALID_PARTY_IDS.has(partyId) || typeof pct !== "number" || pct < 0 || pct > 100) {
          return NextResponse.json({ error: "Invalid percentage prediction" }, { status: 400 });
        }
      }
    }

    // Validate optional coalition pick
    if (coalitionPick) {
      if (!Array.isArray(coalitionPick) || coalitionPick.some((id) => !VALID_PARTY_IDS.has(id))) {
        return NextResponse.json({ error: "Invalid coalition pick" }, { status: 400 });
      }
    }

    let visitorId = request.cookies.get("pt_visitor")?.value;
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }

    const db = getDb();
    await ensureSeeded(db);

    // Resolve authenticated user if session exists
    let userId: string | null = null;
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
    if (sessionToken) {
      const session = await validateSession(sessionToken, db);
      if (session) userId = session.userId;
    }

    // Database-backed rate limiting (persists across serverless invocations)
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (await isRateLimited(db, ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Check duplicate: by cookie (visitorId) OR by fingerprint OR by userId
    const conditions = [eq(userPredictions.visitorId, visitorId)];
    if (fingerprint) {
      conditions.push(eq(userPredictions.fingerprint, fingerprint));
    }
    if (userId) {
      conditions.push(eq(userPredictions.userId, userId));
    }

    const existingVote = await db
      .select()
      .from(userPredictions)
      .where(or(...conditions))
      .limit(1);

    if (existingVote.length > 0) {
      return NextResponse.json(
        { error: "already_voted", partyId: existingVote[0].partyId },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Record the individual vote (UNIQUE index on visitor_id catches races)
    try {
      await db.insert(userPredictions).values({
        id: crypto.randomUUID(),
        visitorId,
        partyId: selectedWinner,
        createdAt: now,
        fingerprint: fingerprint || null,
        userId,
        predictedPct: predictedPercentages?.[selectedWinner] ?? null,
        coalitionPick: coalitionPick ? JSON.stringify(coalitionPick) : null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("UNIQUE constraint failed")) {
        return NextResponse.json(
          { error: "already_voted" },
          { status: 409 }
        );
      }
      throw e;
    }

    // Update crowd aggregate atomically
    await db
      .insert(crowdAggregates)
      .values({
        partyId: selectedWinner,
        totalBets: 1,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: crowdAggregates.partyId,
        set: {
          totalBets: sql`${crowdAggregates.totalBets} + 1`,
          computedAt: now,
        },
      });

    const response = NextResponse.json({ success: true, visitorId });

    if (isNewVisitor) {
      response.cookies.set("pt_visitor", visitorId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }

    return response;
  } catch (e) {
    console.error("POST /api/tipovanie error:", e);
    captureException(createSentry(request, { SENTRY_DSN: process.env.SENTRY_DSN }), e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    const aggregates = await db.select().from(crowdAggregates);
    const totalBets = aggregates.reduce((s, a) => s + a.totalBets, 0);

    return NextResponse.json({
      aggregates: aggregates.map((a) => ({
        partyId: a.partyId,
        totalBets: a.totalBets,
      })),
      totalBets,
    });
  } catch (e) {
    console.error("GET /api/tipovanie error:", e);
    captureException(createSentry(request, { SENTRY_DSN: process.env.SENTRY_DSN }), e);
    return NextResponse.json({ aggregates: [], totalBets: 0 });
  }
}
