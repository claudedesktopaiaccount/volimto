"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { SCRAPER_JOB_OPTIONS, ScraperJobId } from "@/lib/admin/scraper-job-options";

type ScraperJobOption = (typeof SCRAPER_JOB_OPTIONS)[number];

interface ScraperEvent {
  type: "run_start" | "job_start" | "job_done" | "job_error" | "run_complete";
  id?: ScraperJobId;
  job?: ScraperJobOption;
  completed?: number;
  failed?: number;
  total?: number;
  startedAt?: number;
  durationMs?: number;
  result?: {
    ok: boolean;
    status: number;
    data: unknown;
  };
}

interface RunState {
  running: boolean;
  completed: number;
  failed: number;
  total: number;
  startedAt: number | null;
  currentJob: string;
  events: ScraperEvent[];
  message: string;
}

const initialRunState: RunState = {
  running: false,
  completed: 0,
  failed: 0,
  total: 0,
  startedAt: null,
  currentJob: "",
  events: [],
  message: "",
};

export default function AdminScrapersClient({ jobs }: { jobs: readonly ScraperJobOption[] }) {
  const allIds = useMemo(() => jobs.map((job) => job.id), [jobs]);
  const [selectedIds, setSelectedIds] = useState<ScraperJobId[]>(allIds);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!runState.running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runState.running]);

  const percent = runState.total > 0
    ? Math.round((runState.completed / runState.total) * 100)
    : 0;
  const elapsedMs = runState.startedAt ? now - runState.startedAt : 0;
  const etaMs = runState.startedAt && runState.completed > 0 && runState.completed < runState.total
    ? Math.max(0, (elapsedMs / runState.completed) * (runState.total - runState.completed))
    : null;

  function toggle(id: ScraperJobId) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function run(jobIds: ScraperJobId[]) {
    if (runState.running || jobIds.length === 0) return;

    setNow(Date.now());
    setRunState({
      ...initialRunState,
      running: true,
      total: jobIds.length,
      startedAt: Date.now(),
      message: "Spúšťam scrapery...",
    });

    try {
      const res = await fetch("/api/admin/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Spustenie zlyhalo.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          applyEvent(JSON.parse(line) as ScraperEvent);
        }
      }

      if (buffer.trim()) {
        applyEvent(JSON.parse(buffer) as ScraperEvent);
      }
    } catch (error) {
      setRunState((current) => ({
        ...current,
        running: false,
        message: error instanceof Error ? error.message : "Spustenie zlyhalo.",
      }));
    }
  }

  function applyEvent(event: ScraperEvent) {
    setNow(Date.now());
    setRunState((current) => {
      const next: RunState = {
        ...current,
        events: [...current.events, event],
      };

      if (event.type === "run_start") {
        next.total = event.total ?? current.total;
        next.startedAt = event.startedAt ?? current.startedAt;
        next.message = "Scrapery bežia.";
      }
      if (event.type === "job_start") {
        next.currentJob = event.job?.label ?? event.id ?? "";
        next.message = `Beží: ${next.currentJob}`;
      }
      if (event.type === "job_done" || event.type === "job_error") {
        next.completed = event.completed ?? current.completed;
        next.failed = event.failed ?? current.failed;
        next.total = event.total ?? current.total;
        next.currentJob = "";
        next.message = event.type === "job_done"
          ? `Dokončené: ${event.job?.label ?? event.id}`
          : `Chyba: ${event.job?.label ?? event.id}`;
      }
      if (event.type === "run_complete") {
        next.running = false;
        next.completed = event.completed ?? current.completed;
        next.failed = event.failed ?? current.failed;
        next.total = event.total ?? current.total;
        next.currentJob = "";
        next.message = next.failed > 0
          ? `Hotovo s chybami: ${next.failed}/${next.total}.`
          : "Všetky vybrané scrapery dobehli.";
      }

      return next;
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Scrapery</h1>
          <p className="mt-1 text-sm text-muted">
            Manuálne spustenie scraperov jednotlivo alebo spolu, s priebehom a odhadom dokončenia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(allIds)}
            disabled={runState.running}
            className={buttonClasses({ size: "sm" })}
          >
            Vybrať všetko
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={runState.running}
            className={buttonClasses({ size: "sm", variant: "ghost" })}
          >
            Zrušiť výber
          </button>
        </div>
      </div>

      <section className="mb-6 border border-divider p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Beh</p>
            <p className="mt-1 text-sm text-ink">{runState.message || "Pripravené."}</p>
            {runState.currentJob && <p className="mt-1 text-xs text-muted">Aktuálne: {runState.currentJob}</p>}
          </div>
          <div className="text-right text-sm text-muted">
            <div>{runState.completed}/{runState.total || selectedIds.length} hotovo</div>
            <div>Čas: {formatDuration(elapsedMs)}</div>
            <div>ETA: {etaMs === null ? "po prvom dokončenom jobe" : formatDuration(etaMs)}</div>
          </div>
        </div>

        <div className="h-3 overflow-hidden bg-hover">
          <div className="h-full bg-ink transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{percent}%</span>
          <span>{runState.failed > 0 ? `Chyby: ${runState.failed}` : "Bez chýb"}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run(selectedIds)}
            disabled={runState.running || selectedIds.length === 0}
            className={buttonClasses({ variant: "primary" })}
          >
            {runState.running ? "Beží..." : `Spustiť vybrané (${selectedIds.length})`}
          </button>
          <button
            type="button"
            onClick={() => run(allIds)}
            disabled={runState.running}
            className={buttonClasses()}
          >
            Spustiť všetko
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {jobs.map((job) => {
          const selected = selectedIds.includes(job.id);
          return (
            <div key={job.id} className="border border-divider p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={runState.running}
                    onChange={() => toggle(job.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-ink">{job.label}</span>
                    <span className="mt-1 block text-sm text-muted">{job.description}</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => run([job.id])}
                  disabled={runState.running}
                  className={buttonClasses({ size: "sm", className: "shrink-0" })}
                >
                  Spustiť
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {runState.events.length > 0 && (
        <section className="mt-6 border border-divider p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Log behu</h2>
          <div className="space-y-2">
            {runState.events
              .filter((event) => event.type !== "run_start")
              .map((event, index) => (
                <ScraperLogRow key={`${event.type}-${event.id ?? "run"}-${index}`} event={event} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScraperLogRow({ event }: { event: ScraperEvent }) {
  const isError = event.type === "job_error";
  const isDone = event.type === "job_done";
  const title = event.type === "run_complete"
    ? "Beh dokončený"
    : `${event.job?.label ?? event.id ?? "Job"} - ${isError ? "chyba" : isDone ? "hotovo" : "štart"}`;

  return (
    <div className={cn("border px-3 py-2 text-sm", isError ? "border-red-300" : "border-divider")}>
      <div className="flex flex-wrap justify-between gap-2">
        <span className={cn("font-semibold", isError ? "text-red-700" : "text-ink")}>{title}</span>
        {typeof event.durationMs === "number" && (
          <span className="text-muted">{formatDuration(event.durationMs)}</span>
        )}
      </div>
      {event.result && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap bg-hover p-2 text-xs text-muted">
          {JSON.stringify(event.result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0 s";
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} h ${restMinutes} min` : `${hours} h`;
}
