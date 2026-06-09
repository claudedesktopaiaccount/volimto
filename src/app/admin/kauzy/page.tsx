"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { fieldClasses } from "@/components/ui/Field";
import {
  GEMINI_APPROVAL_CRITERIA,
  GEMINI_MANUAL_REVIEW_CRITERIA,
  GEMINI_REJECTION_CRITERIA,
  GEMINI_REVIEW_WORKFLOW,
} from "@/lib/scandals/review-criteria";
import { cn } from "@/lib/utils";

interface DraftRow {
  id: number;
  scandalId: number;
  scandalTitle: string;
  scandalSlug: string;
  caseSummarySk: string;
  publicInterestSk: string;
  legalStatusSk: string;
  openQuestionsSk: string;
  actorClaimsJson: string;
  sourceUrlsJson: string;
  reviewStatus: string;
  model: string;
  createdAt: string;
  reviewedAt: string | null;
}

interface AutoReviewResult {
  id: number;
  decision: "approve" | "reject" | "needs_review";
  confidence: number;
  reasonSk: string;
  model?: string;
  error?: string;
}

type BusyAction = "save" | "approve" | "reject" | "regenerate" | "auto_review" | "auto_review_queue" | null;

interface QueueProgress {
  total: number;
  completed: number;
  startedAt: number;
  currentTitle: string;
  results: AutoReviewResult[];
}

const STATUSES = [
  { value: "needs_review", label: "Na kontrolu" },
  { value: "approved", label: "Schválené" },
  { value: "rejected", label: "Zamietnuté" },
  { value: "all", label: "Všetko" },
];

async function fetchDraftRows(nextStatus: string) {
  const res = await fetch(`/api/admin/kauzy?status=${encodeURIComponent(nextStatus)}`);
  if (!res.ok) return [];
  return await res.json() as DraftRow[];
}

export default function AdminKauzyPage() {
  const [status, setStatus] = useState("needs_review");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<DraftRow | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [lastAutoReview, setLastAutoReview] = useState<AutoReviewResult | null>(null);
  const [queueProgress, setQueueProgress] = useState<QueueProgress | null>(null);
  const [regenUrl, setRegenUrl] = useState("");
  const busy = busyAction !== null;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingDrafts(true);
      const rows = await fetchDraftRows(status);
      if (cancelled) return;
      const next = rows[0] ?? null;
      setDrafts(rows);
      setSelectedId(next?.id ?? null);
      setForm(next ? { ...next } : null);
      setRegenUrl(firstSourceUrl(next?.sourceUrlsJson ?? ""));
      setLoadingDrafts(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function reload() {
    const rows = await fetchDraftRows(status);
    const next = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
    setDrafts(rows);
    setSelectedId(next?.id ?? null);
    setForm(next ? { ...next } : null);
    setRegenUrl(firstSourceUrl(next?.sourceUrlsJson ?? ""));
  }

  async function save() {
    if (!form) return;
    setBusyAction("save");
    setMessage("");
    setLastAutoReview(null);
    const res = await fetch("/api/admin/kauzy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusyAction(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "Uloženie zlyhalo.");
      return;
    }
    setMessage("Uložené.");
    await reload();
  }

  async function postAutoReview(draftId: number): Promise<AutoReviewResult> {
    try {
      const res = await fetch("/api/admin/kauzy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, action: "auto_review" }),
      });
      const data = await res.json().catch(() => ({})) as { result?: AutoReviewResult; message?: string };
      if (res.ok && data.result) return data.result;
      return {
        id: draftId,
        decision: "needs_review",
        confidence: 0,
        reasonSk: "Automatická kontrola zlyhala; draft zostáva na ručnú kontrolu.",
        error: data.message ?? "Akcia zlyhala.",
      };
    } catch (error) {
      return {
        id: draftId,
        decision: "needs_review",
        confidence: 0,
        reasonSk: "Automatická kontrola zlyhala; draft zostáva na ručnú kontrolu.",
        error: error instanceof Error ? error.message : "unknown_error",
      };
    }
  }

  async function action(actionName: "approve" | "reject" | "regenerate" | "auto_review") {
    if (!form) return;
    setBusyAction(actionName);
    setMessage("");
    setLastAutoReview(null);
    if (actionName === "auto_review") {
      const result = await postAutoReview(form.id);
      setBusyAction(null);
      setLastAutoReview(result);
      setMessage(formatAutoReviewMessage(result));
      await reload();
      return;
    }

    const res = await fetch("/api/admin/kauzy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        action: actionName,
        sourceUrl: actionName === "regenerate" ? regenUrl : undefined,
      }),
    });
    setBusyAction(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "Akcia zlyhala.");
      return;
    }
    setMessage(actionName === "approve"
      ? "Schválené."
      : actionName === "reject"
        ? "Zamietnuté."
        : actionName === "regenerate"
          ? "Regenerované."
          : "Hotovo.");
    await reload();
  }

  async function autoReviewQueue() {
    setBusyAction("auto_review_queue");
    setMessage("");
    setLastAutoReview(null);
    setQueueProgress(null);

    const queue = (await fetchDraftRows("needs_review")).slice(0, 10);
    if (queue.length === 0) {
      setBusyAction(null);
      setMessage("Vo fronte nie sú žiadne drafty na kontrolu.");
      await reload();
      return;
    }

    const startedAt = Date.now();
    const results: AutoReviewResult[] = [];
    setQueueProgress({
      total: queue.length,
      completed: 0,
      startedAt,
      currentTitle: queue[0]?.scandalTitle ?? "",
      results,
    });

    for (const [index, draft] of queue.entries()) {
      setQueueProgress((current) => current ? {
        ...current,
        currentTitle: draft.scandalTitle,
      } : current);
      const result = await postAutoReview(draft.id);
      results.push(result);
      setLastAutoReview(result);
      setQueueProgress({
        total: queue.length,
        completed: index + 1,
        startedAt,
        currentTitle: queue[index + 1]?.scandalTitle ?? "",
        results: [...results],
      });
    }

    setBusyAction(null);
    const approved = results.filter((item) => item.decision === "approve").length;
    const rejected = results.filter((item) => item.decision === "reject").length;
    const manual = results.filter((item) => item.decision === "needs_review").length;
    const failed = results.filter((item) => item.error).length;
    setMessage(`Gemini spracoval ${results.length}: schválené ${approved}, zamietnuté ${rejected}, ručne ${manual}${failed ? `, chyby ${failed}` : ""}.`);
    await reload();
  }

  function update<K extends keyof DraftRow>(key: K, value: DraftRow[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Kauzy - review analýz</h1>
          <p className="mt-1 text-sm text-muted">Publikované sú iba schválené claimy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={autoReviewQueue}
            disabled={busy}
            className="border border-ink px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {busyAction === "auto_review_queue" ? "Gemini spracúva frontu..." : "Gemini: spracovať 10"}
          </button>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="border border-divider bg-surface px-3 py-2 text-sm"
          >
            {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <GeminiReviewPanel busyAction={busyAction} lastResult={lastAutoReview} queueProgress={queueProgress} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="border border-divider">
          {loadingDrafts ? (
            <p className="p-4 text-sm text-muted">Načítavam drafty...</p>
          ) : drafts.length === 0 ? (
            <p className="p-4 text-sm text-muted">Žiadne drafty.</p>
          ) : drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => {
                setSelectedId(draft.id);
                setForm({ ...draft });
                setRegenUrl(firstSourceUrl(draft.sourceUrlsJson));
              }}
              className={`block w-full border-b border-divider p-3 text-left text-sm hover:bg-hover ${
                selectedId === draft.id ? "bg-hover" : "bg-surface"
              }`}
            >
              <span className="block font-semibold text-ink">{draft.scandalTitle}</span>
              <span className="mt-1 block text-xs text-muted">{draft.reviewStatus} · {draft.model}</span>
            </button>
          ))}
        </aside>

        {form && (
          <section className="space-y-4">
            <div className="border border-divider p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{form.scandalSlug}</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{form.scandalTitle}</h2>
              <p className="mt-2 text-xs text-muted">Draft #{form.id} · {form.createdAt}</p>
            </div>

            <Field label="O čo ide">
              <textarea value={form.caseSummarySk} onChange={(event) => update("caseSummarySk", event.target.value)} rows={4} className={fieldClasses} />
            </Field>
            <Field label="Verejný záujem">
              <textarea value={form.publicInterestSk} onChange={(event) => update("publicInterestSk", event.target.value)} rows={3} className={fieldClasses} />
            </Field>
            <Field label="Procesný stav">
              <textarea value={form.legalStatusSk} onChange={(event) => update("legalStatusSk", event.target.value)} rows={2} className={fieldClasses} />
            </Field>
            <Field label="Otvorené otázky">
              <textarea value={form.openQuestionsSk} onChange={(event) => update("openQuestionsSk", event.target.value)} rows={2} className={fieldClasses} />
            </Field>
            <Field label="Actor claimy JSON">
              <textarea value={form.actorClaimsJson} onChange={(event) => update("actorClaimsJson", event.target.value)} rows={12} className={cn(fieldClasses, "font-mono text-xs")} />
            </Field>
            <Field label="Trusted zdroje JSON">
              <textarea value={form.sourceUrlsJson} onChange={(event) => update("sourceUrlsJson", event.target.value)} rows={4} className={cn(fieldClasses, "font-mono text-xs")} />
            </Field>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} disabled={busy} className="bg-ink px-4 py-2 text-sm font-semibold text-surface disabled:opacity-40">
                {busyAction === "save" ? "Ukladám..." : "Uložiť"}
              </button>
              <button type="button" onClick={() => action("approve")} disabled={busy} className="border border-ink px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
                {busyAction === "approve" ? "Schvaľujem..." : "Schváliť"}
              </button>
              <button type="button" onClick={() => action("reject")} disabled={busy} className="border border-divider px-4 py-2 text-sm font-semibold text-muted disabled:opacity-40">
                {busyAction === "reject" ? "Zamietam..." : "Zamietnuť"}
              </button>
              <button type="button" onClick={() => action("auto_review")} disabled={busy} className="border border-ink px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
                {busyAction === "auto_review" ? "Gemini pracuje..." : "Gemini review"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border border-divider p-3">
              <input value={regenUrl} onChange={(event) => setRegenUrl(event.target.value)} className={cn(fieldClasses, "min-w-72 flex-1")} placeholder="Trusted URL pre regenerovanie" />
              <button type="button" onClick={() => action("regenerate")} disabled={busy || !regenUrl} className="border border-divider px-4 py-2 text-sm font-semibold disabled:opacity-40">
                {busyAction === "regenerate" ? "Regenerujem..." : "Regenerovať"}
              </button>
            </div>

            {message && <p className="text-sm text-muted">{message}</p>}
          </section>
        )}
      </div>
    </div>
  );
}

function GeminiReviewPanel({
  busyAction,
  lastResult,
  queueProgress,
}: {
  busyAction: BusyAction;
  lastResult: AutoReviewResult | null;
  queueProgress: QueueProgress | null;
}) {
  const queuePercent = queueProgress
    ? Math.round((queueProgress.completed / queueProgress.total) * 100)
    : 0;
  const eta = queueProgress ? estimatedQueueRemaining(queueProgress) : null;

  return (
    <section className="mb-6 border border-divider p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Gemini automatizácia</p>
          <h2 className="mt-1 text-lg font-bold text-ink">Ako Gemini schvaľuje alebo zamieta</h2>
        </div>
        <div className={cn(
          "border px-3 py-2 text-sm font-semibold",
          busyAction?.startsWith("auto_review")
            ? "border-ink text-ink"
            : lastResult
              ? "border-divider text-muted"
              : "border-divider text-muted"
        )}>
          {busyAction?.startsWith("auto_review")
            ? statusTextForBusyAction(busyAction)
            : lastResult
              ? `Posledné: ${decisionLabel(lastResult.decision)} (${Math.round(lastResult.confidence * 100)}%)`
              : "Pripravené"}
        </div>
      </div>

      {busyAction?.startsWith("auto_review") && (
        <p className="mt-3 border border-divider bg-hover px-3 py-2 text-sm text-ink">
          Gemini teraz číta trusted zdroje, vracia štruktúrovaný JSON, server validuje zdroje a podľa verdiktu uloží úpravy,
          schváli, zamietne alebo ponechá draft na ručnú kontrolu.
        </p>
      )}

      {queueProgress && (
        <div className="mt-3 border border-divider p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-ink">
              Fronta: {queueProgress.completed}/{queueProgress.total} ({queuePercent}%)
            </span>
            <span className="text-muted">
              {eta ? `Odhad do konca: ${eta}` : "Odhad po prvom dokončenom drafte"}
            </span>
          </div>
          <div className="h-2 overflow-hidden bg-hover">
            <div className="h-full bg-ink transition-all" style={{ width: `${queuePercent}%` }} />
          </div>
          {busyAction === "auto_review_queue" && queueProgress.currentTitle && (
            <p className="mt-2 text-xs text-muted">Aktuálne: {queueProgress.currentTitle}</p>
          )}
        </div>
      )}

      {lastResult && (
        <p className="mt-3 border border-divider px-3 py-2 text-sm text-muted">
          <span className="font-semibold text-ink">{decisionLabel(lastResult.decision)}:</span>{" "}
          {lastResult.reasonSk}
          {lastResult.error ? ` Chyba: ${lastResult.error}` : ""}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <CriteriaList title="Postup" items={GEMINI_REVIEW_WORKFLOW} />
        <CriteriaList title="Schváli iba ak" items={GEMINI_APPROVAL_CRITERIA} />
        <CriteriaList title="Zamietne ak" items={GEMINI_REJECTION_CRITERIA} />
        <CriteriaList title="Ručná kontrola ak" items={GEMINI_MANUAL_REVIEW_CRITERIA} />
      </div>
    </section>
  );
}

function CriteriaList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-1 text-sm text-ink">
        {items.map((item) => (
          <li key={item} className="border-l border-divider pl-2">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function firstSourceUrl(raw: string) {
  try {
    const urls = JSON.parse(raw) as unknown;
    return Array.isArray(urls) && typeof urls[0] === "string" ? urls[0] : "";
  } catch {
    return "";
  }
}

function formatAutoReviewMessage(result: AutoReviewResult | undefined) {
  if (!result) return "Gemini review dokončil akciu.";
  const confidence = Math.round(result.confidence * 100);
  return `Gemini: ${decisionLabel(result.decision)} (${confidence}%). ${result.reasonSk}`;
}

function decisionLabel(decision: AutoReviewResult["decision"]) {
  if (decision === "approve") return "schválené";
  if (decision === "reject") return "zamietnuté";
  return "ponechané na ručnú kontrolu";
}

function statusTextForBusyAction(action: BusyAction) {
  if (action === "auto_review_queue") return "Gemini spracúva frontu";
  if (action === "auto_review") return "Gemini kontroluje draft";
  return "Pracujem";
}

function estimatedQueueRemaining(progress: QueueProgress) {
  if (progress.completed === 0) return null;
  const elapsedMs = Date.now() - progress.startedAt;
  const averageMs = elapsedMs / progress.completed;
  const remainingMs = Math.max(0, (progress.total - progress.completed) * averageMs);
  return formatDuration(remainingMs);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}
