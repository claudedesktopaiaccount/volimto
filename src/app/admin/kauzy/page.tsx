"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { fieldClasses } from "@/components/ui/Field";
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

const STATUSES = [
  { value: "needs_review", label: "Na kontrolu" },
  { value: "approved", label: "Schvalene" },
  { value: "rejected", label: "Zamietnute" },
  { value: "all", label: "Vsetko" },
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
  const [busy, setBusy] = useState(false);
  const [regenUrl, setRegenUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const rows = await fetchDraftRows(status);
      if (cancelled) return;
      const next = rows[0] ?? null;
      setDrafts(rows);
      setSelectedId(next?.id ?? null);
      setForm(next ? { ...next } : null);
      setRegenUrl(firstSourceUrl(next?.sourceUrlsJson ?? ""));
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
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/kauzy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "Ulozenie zlyhalo.");
      return;
    }
    setMessage("Ulozene.");
    await reload();
  }

  async function action(actionName: "approve" | "reject" | "regenerate") {
    if (!form) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/kauzy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        action: actionName,
        sourceUrl: actionName === "regenerate" ? regenUrl : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "Akcia zlyhala.");
      return;
    }
    setMessage(actionName === "approve" ? "Schvalene." : actionName === "reject" ? "Zamietnute." : "Regenerovane.");
    await reload();
  }

  function update<K extends keyof DraftRow>(key: K, value: DraftRow[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Kauzy - review analyz</h1>
          <p className="mt-1 text-sm text-muted">Publikovane su iba schvalene claimy.</p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="border border-divider bg-surface px-3 py-2 text-sm"
        >
          {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="border border-divider">
          {drafts.length === 0 ? (
            <p className="p-4 text-sm text-muted">Ziadne drafty.</p>
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

            <Field label="O co ide">
              <textarea value={form.caseSummarySk} onChange={(event) => update("caseSummarySk", event.target.value)} rows={4} className={fieldClasses} />
            </Field>
            <Field label="Verejny zaujem">
              <textarea value={form.publicInterestSk} onChange={(event) => update("publicInterestSk", event.target.value)} rows={3} className={fieldClasses} />
            </Field>
            <Field label="Procesny stav">
              <textarea value={form.legalStatusSk} onChange={(event) => update("legalStatusSk", event.target.value)} rows={2} className={fieldClasses} />
            </Field>
            <Field label="Otvorene otazky">
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
                Ulozit
              </button>
              <button type="button" onClick={() => action("approve")} disabled={busy} className="border border-ink px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
                Schvalit
              </button>
              <button type="button" onClick={() => action("reject")} disabled={busy} className="border border-divider px-4 py-2 text-sm font-semibold text-muted disabled:opacity-40">
                Zamietnut
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border border-divider p-3">
              <input value={regenUrl} onChange={(event) => setRegenUrl(event.target.value)} className={cn(fieldClasses, "min-w-72 flex-1")} placeholder="Trusted URL pre regenerovanie" />
              <button type="button" onClick={() => action("regenerate")} disabled={busy || !regenUrl} className="border border-divider px-4 py-2 text-sm font-semibold disabled:opacity-40">
                Regenerovat
              </button>
            </div>

            {message && <p className="text-sm text-muted">{message}</p>}
          </section>
        )}
      </div>
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
