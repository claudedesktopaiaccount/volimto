import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  autoReviewScandalAnalysisDraft,
  autoReviewScandalAnalysisDraftQueue,
  approveScandalAnalysisDraft,
  listScandalAnalysisDrafts,
  rejectScandalAnalysisDraft,
  regenerateScandalAnalysisDraft,
  saveScandalAnalysisDraft,
} from "@/lib/db/scandal-analysis";
import { fetchTrustedScandalPageText } from "@/lib/scandals/fetch-page";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") ?? "needs_review";
  const drafts = await listScandalAnalysisDrafts(
    getDb(),
    status === "all" || status === "approved" || status === "rejected" || status === "needs_review"
      ? status
      : "needs_review"
  );
  return NextResponse.json(drafts);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { id?: number } & Record<string, unknown> | null;
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    await saveScandalAnalysisDraft(getDb(), body.id, {
      caseSummarySk: typeof body.caseSummarySk === "string" ? body.caseSummarySk : undefined,
      publicInterestSk: typeof body.publicInterestSk === "string" ? body.publicInterestSk : undefined,
      legalStatusSk: typeof body.legalStatusSk === "string" ? body.legalStatusSk : undefined,
      openQuestionsSk: typeof body.openQuestionsSk === "string" ? body.openQuestionsSk : undefined,
      actorClaimsJson: typeof body.actorClaimsJson === "string" ? body.actorClaimsJson : undefined,
      sourceUrlsJson: typeof body.sourceUrlsJson === "string" ? body.sourceUrlsJson : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "invalid_draft", message: errorMessage(error) }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    id?: number;
    action?: string;
    sourceUrl?: string;
    limit?: number;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "missing_action" }, { status: 400 });

  try {
    if (body.action === "approve") {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      await approveScandalAnalysisDraft(getDb(), body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reject") {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      await rejectScandalAnalysisDraft(getDb(), body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "regenerate") {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      if (!body.sourceUrl) return NextResponse.json({ error: "missing_source_url" }, { status: 400 });
      const pageText = await fetchTrustedScandalPageText(body.sourceUrl);
      await regenerateScandalAnalysisDraft(getDb(), body.id, pageText);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "auto_review") {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "missing_gemini_api_key" }, { status: 503 });
      }
      const result = await autoReviewScandalAnalysisDraft(getDb(), body.id, process.env.GEMINI_API_KEY);
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === "auto_review_queue") {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "missing_gemini_api_key" }, { status: 503 });
      }
      const results = await autoReviewScandalAnalysisDraftQueue(
        getDb(),
        process.env.GEMINI_API_KEY,
        typeof body.limit === "number" ? body.limit : 10
      );
      return NextResponse.json({ ok: true, results });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "action_failed", message: errorMessage(error) }, { status: 422 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}
