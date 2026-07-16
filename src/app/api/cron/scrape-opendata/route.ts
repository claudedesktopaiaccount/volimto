import { NextRequest, NextResponse } from "next/server";
import {
  formatOpendataImportError,
  runConfiguredOpendataImport,
} from "@/lib/opendata-import";
import { isCronAuthed } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runConfiguredOpendataImport();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] scrape-opendata error:", error);
    return NextResponse.json(formatOpendataImportError(error), { status: 502 });
  }
}
