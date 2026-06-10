"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PARTY_LIST } from "@/lib/parties";
import { initialSavePollState, savePollAction } from "./actions";

export default function AdminPolls() {
  const [state, formAction] = useActionState(savePollAction, initialSavePollState);

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl font-bold text-ink mb-6">Manuálny prieskum</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="agency"
          placeholder="Agentúra (napr. Focus)"
          required
          className="border border-divider px-3 py-2 text-sm bg-surface"
        />
        <input
          name="publishedDate"
          type="date"
          required
          className="border border-divider px-3 py-2 text-sm bg-surface"
        />
        <div className="grid grid-cols-2 gap-2">
          {PARTY_LIST.map((party) => (
            <div key={party.id} className="flex items-center gap-2">
              <label className="text-xs font-mono w-20 text-muted">{party.abbreviation}</label>
              <input
                name={`result:${party.id}`}
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="%"
                className="flex-1 border border-divider px-2 py-1 text-sm bg-surface"
              />
            </div>
          ))}
        </div>
        <SubmitButton />
        {state.message && (
          <p className={`text-sm ${state.status === "success" ? "text-green-700" : "text-red-600"}`}>
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ink text-surface px-4 py-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
    >
      {pending ? "Ukladám..." : "Uložiť prieskum"}
    </button>
  );
}
