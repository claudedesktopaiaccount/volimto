import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  getScraperJobMeta,
  parseScraperJobIds,
  runScraperJob,
} from "@/lib/admin/scraper-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { jobIds?: unknown } | null;
  const jobIds = parseScraperJobIds(body?.jobIds);
  if (jobIds.length === 0) {
    return NextResponse.json({ error: "missing_jobs" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let completed = 0;
  let failed = 0;
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }

      send({
        type: "run_start",
        total: jobIds.length,
        startedAt,
        jobs: jobIds.map((id) => getScraperJobMeta(id)),
      });

      for (const [index, id] of jobIds.entries()) {
        const job = getScraperJobMeta(id);
        const jobStartedAt = Date.now();
        send({
          type: "job_start",
          id,
          job,
          index,
          completed,
          total: jobIds.length,
          startedAt,
          jobStartedAt,
        });

        try {
          const result = await runScraperJob(id);
          completed++;
          if (!result.ok) failed++;
          send({
            type: result.ok ? "job_done" : "job_error",
            id,
            job,
            index,
            completed,
            failed,
            total: jobIds.length,
            durationMs: Date.now() - jobStartedAt,
            result,
          });
        } catch (error) {
          completed++;
          failed++;
          send({
            type: "job_error",
            id,
            job,
            index,
            completed,
            failed,
            total: jobIds.length,
            durationMs: Date.now() - jobStartedAt,
            result: {
              ok: false,
              status: 500,
              data: { error: error instanceof Error ? error.message : "Unknown error" },
            },
          });
        }
      }

      send({
        type: "run_complete",
        completed,
        failed,
        total: jobIds.length,
        durationMs: Date.now() - startedAt,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
