"use client";

import { useEffect, useState } from "react";
import { PARTY_LIST } from "@/lib/parties";

interface PartyPromise { id: number; partyId: string; promiseText: string; category: string; isPro: boolean; sourceUrl: string | null }
interface PreviewRow { text: string; category: string; isPro: boolean }

const CATEGORIES = [
  "Ekonomika", "Sociálne veci", "Zdravotníctvo", "Školstvo",
  "Zahraničná politika", "Bezpečnosť", "Životné prostredie",
  "Kultúra", "Spravodlivosť",
];

export default function AdminPromises() {
  const [promises, setPromises] = useState<PartyPromise[]>([]);
  const [form, setForm] = useState({ partyId: "ps", promiseText: "", category: "", isPro: true, sourceUrl: "" });

  // Import state
  const [importPartyId, setImportPartyId] = useState("smer-sd");
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [showTextarea, setShowTextarea] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [saving, setSaving] = useState(false);

  async function fetchPromises() {
    const res = await fetch("/api/admin/promises");
    if (!res.ok) return [];
    return await res.json() as PartyPromise[];
  }

  async function load() {
    setPromises(await fetchPromises());
  }

  useEffect(() => {
    fetchPromises().then(setPromises);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/promises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ partyId: "ps", promiseText: "", category: "", isPro: true, sourceUrl: "" });
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Zmazať tento sľub?")) return;
    await fetch("/api/admin/promises", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function handleImport() {
    setImporting(true);
    setImportError("");
    setPreview([]);

    const body = showTextarea
      ? { rawText: importText }
      : { url: importUrl };

    try {
    const res = await fetch("/api/admin/import-promises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as { promises?: PreviewRow[]; error?: string; message?: string };
    setImporting(false);

    if (!res.ok) {
      if (data.error === "fetch_failed") {
        setImportError("Nepodarilo sa načítať URL. Vlož text programu ručne.");
        setShowTextarea(true);
      } else {
        setImportError(data.message ?? data.error ?? "Chyba pri extrakcii.");
      }
      return;
    }

    setPreview(data.promises ?? []);
    } catch {
      setImporting(false);
      setImportError("Chyba siete. Skús znova.");
    }
  }

  function updatePreviewRow(index: number, patch: Partial<PreviewRow>) {
    setPreview(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  }

  function removePreviewRow(index: number) {
    setPreview(rows => rows.filter((_, i) => i !== index));
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const results = await Promise.all(preview.map(row =>
        fetch("/api/admin/promises", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partyId: importPartyId,
            promiseText: row.text,
            category: row.category,
            isPro: row.isPro,
            sourceUrl: importUrl || null,
          }),
        })
      ));
      const failed = results.filter(r => !r.ok).length;
      if (failed > 0) {
        setImportError(`${failed} sľubov sa nepodarilo uložiť. Skús znova.`);
        return;
      }
      setPreview([]);
      setImportUrl("");
      setImportText("");
      setShowTextarea(false);
      load();
    } catch {
      setImportError("Chyba pri ukladaní. Skús znova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink mb-6">Programové sľuby</h1>

      {/* ── Import section ──────────────────────────────────────── */}
      <div className="mb-8 p-4 border border-divider">
        <h2 className="font-semibold text-sm text-muted uppercase tracking-wide mb-3">Importovať z programu</h2>

        <div className="flex gap-2 mb-2 flex-wrap">
          <select
            value={importPartyId}
            onChange={e => setImportPartyId(e.target.value)}
            className="border border-divider px-2 py-2 text-sm bg-surface"
          >
            {PARTY_LIST.map(p => <option key={p.id} value={p.id}>{p.abbreviation}</option>)}
          </select>

          {!showTextarea && (
            <input
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              placeholder="https://strana.sk/program"
              className="border border-divider px-2 py-2 text-sm bg-surface flex-1 min-w-48"
            />
          )}

          <button
            onClick={handleImport}
            disabled={importing || (!importUrl && !importText)}
            className="bg-ink text-surface px-4 py-2 text-sm font-semibold hover:opacity-80 disabled:opacity-40"
          >
            {importing ? "Načítavam…" : "Načítať"}
          </button>

          <button
            onClick={() => setShowTextarea(v => !v)}
            className="border border-divider px-3 py-2 text-sm text-muted hover:bg-hover"
          >
            {showTextarea ? "Použiť URL" : "Vlož text"}
          </button>
        </div>

        {showTextarea && (
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Vlož text straníckeho programu…"
            rows={6}
            className="border border-divider px-2 py-2 text-sm bg-surface w-full mb-2"
          />
        )}

        {importError && (
          <p className="text-red-500 text-sm mb-2">{importError}</p>
        )}

        {preview.length > 0 && (
          <>
            <p className="text-sm text-muted mb-2">{preview.length} sľubov extrahovaných — skontroluj a uprav:</p>
            <table className="w-full text-sm border-collapse mb-3">
              <thead>
                <tr className="border-b border-divider text-left">
                  <th className="py-2 pr-2 font-semibold text-muted text-xs uppercase tracking-wide w-1/2">Text sľubu</th>
                  <th className="py-2 pr-2 font-semibold text-muted text-xs uppercase tracking-wide">Kategória</th>
                  <th className="py-2 pr-2 font-semibold text-muted text-xs uppercase tracking-wide">Za</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-divider">
                    <td className="py-1 pr-2">
                      <input
                        value={row.text}
                        onChange={e => updatePreviewRow(i, { text: e.target.value })}
                        className="border border-divider px-2 py-1 text-sm bg-surface w-full"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={row.category}
                        onChange={e => updatePreviewRow(i, { category: e.target.value })}
                        className="border border-divider px-1 py-1 text-sm bg-surface"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="checkbox"
                        checked={row.isPro}
                        onChange={e => updatePreviewRow(i, { isPro: e.target.checked })}
                      />
                    </td>
                    <td className="py-1">
                      <button onClick={() => removePreviewRow(i)} className="text-xs text-red-500 hover:text-red-700">Zmazať</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={handleSaveAll}
              disabled={saving || preview.length === 0}
              className="bg-ink text-surface px-4 py-2 text-sm font-semibold hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "Ukladám…" : `Uložiť všetko (${preview.length} sľubov)`}
            </button>
          </>
        )}
      </div>

      {/* ── Manual add form ─────────────────────────────────────── */}
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 p-4 border border-divider">
        <select value={form.partyId} onChange={e => setForm(f => ({ ...f, partyId: e.target.value }))} className="border border-divider px-2 py-2 text-sm bg-surface">
          {PARTY_LIST.map(p => <option key={p.id} value={p.id}>{p.abbreviation}</option>)}
        </select>
        <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Kategória" className="border border-divider px-2 py-2 text-sm bg-surface" required />
        <textarea value={form.promiseText} onChange={e => setForm(f => ({ ...f, promiseText: e.target.value }))} placeholder="Text sľubu" className="border border-divider px-2 py-2 text-sm bg-surface sm:col-span-2" required />
        <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="URL zdroja (voliteľné)" className="border border-divider px-2 py-2 text-sm bg-surface sm:col-span-2" />
        <button type="submit" className="bg-ink text-surface px-4 py-2 text-sm font-semibold sm:col-span-2 hover:opacity-80">Pridať sľub</button>
      </form>

      {/* ── Existing promises list ───────────────────────────────── */}
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b border-divider text-left">
          <th className="py-2 pr-4 font-semibold text-muted text-xs uppercase tracking-wide">Strana</th>
          <th className="py-2 pr-4 font-semibold text-muted text-xs uppercase tracking-wide">Sľub</th>
          <th className="py-2 pr-4 font-semibold text-muted text-xs uppercase tracking-wide">Kategória</th>
          <th className="py-2"></th>
        </tr></thead>
        <tbody>
          {promises.map(p => (
            <tr key={p.id} className="border-b border-divider">
              <td className="py-2 pr-4 font-mono text-xs">{p.partyId}</td>
              <td className="py-2 pr-4">{p.promiseText}</td>
              <td className="py-2 pr-4 text-muted">{p.category}</td>
              <td className="py-2"><button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:text-red-700">Zmazať</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
