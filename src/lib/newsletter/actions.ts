"use server";

import { headers } from "next/headers";
import { subscribeToNewsletter, type NewsletterSubscribeResult } from "./subscribe";

export interface NewsletterActionState {
  status: "idle" | "success" | "duplicate" | "error";
  message?: string;
}

export async function subscribeNewsletterAction(
  _previousState: NewsletterActionState,
  formData: FormData
): Promise<NewsletterActionState> {
  const email = String(formData.get("email") ?? "");
  const source = String(formData.get("source") ?? "web");
  const headerStore = await headers();
  const ip =
    headerStore.get("cf-connecting-ip") ||
    headerStore.get("x-forwarded-for") ||
    "unknown";

  const result: NewsletterSubscribeResult = await subscribeToNewsletter({ email, source, ip });

  if (result.ok) {
    return { status: "success", message: "Prihlásili ste sa. Ďakujeme!" };
  }

  if (result.error === "already_subscribed") {
    return { status: "duplicate", message: "Táto adresa je už prihlásená." };
  }

  if (result.error === "too_many_requests") {
    return { status: "error", message: "Príliš veľa pokusov. Skúste to neskôr." };
  }

  return { status: "error", message: "Chyba. Skúste znova." };
}
