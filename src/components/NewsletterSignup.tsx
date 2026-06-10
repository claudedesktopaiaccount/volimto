"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  subscribeNewsletterAction,
  type NewsletterActionState,
} from "@/lib/newsletter/actions";

interface Props {
  source?: string;
  compact?: boolean;
  inverted?: boolean;
}

export default function NewsletterSignup({ source = "web", compact = false, inverted = false }: Props) {
  const initialState: NewsletterActionState = { status: "idle" };
  const [state, formAction] = useActionState(subscribeNewsletterAction, initialState);

  if (state.status === "success") {
    return (
      <p className={`font-medium ${compact ? "text-sm" : "text-base"}`}>
        ✓ {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className={compact ? "flex gap-2" : "flex flex-col sm:flex-row gap-3 max-w-md"}>
      <input type="hidden" name="source" value={source} />
      <input
        name="email"
        type="email"
        placeholder="váš@email.sk"
        required
        className={`flex-1 px-3 py-2 text-sm focus:outline-none ${inverted ? "border border-white/20 bg-white/10 text-white placeholder-white/40 focus:border-white/60" : "border border-divider bg-surface text-text placeholder-muted focus:border-ink"} ${compact ? "" : "rounded-none"}`}
      />
      <NewsletterSubmitButton inverted={inverted} />
      {state.status === "duplicate" && (
        <p className="text-xs text-muted mt-1 w-full">{state.message}</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-red-600 mt-1 w-full">{state.message}</p>
      )}
    </form>
  );
}

function NewsletterSubmitButton({ inverted }: { inverted: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 whitespace-nowrap hover:opacity-80 ${inverted ? "bg-white text-black" : "bg-ink text-surface"}`}
    >
      {pending ? "..." : "Odoberať"}
    </button>
  );
}
