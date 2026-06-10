"use server";

import { isAdminAuthedFromCookies } from "@/lib/admin-auth";
import { revalidateCacheTag } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import { pollResults, polls } from "@/lib/db/schema";
import { PARTY_LIST } from "@/lib/parties";

export type SavePollState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialSavePollState: SavePollState = { status: "idle" };

export async function savePollAction(
  _previousState: SavePollState,
  formData: FormData
): Promise<SavePollState> {
  if (!(await isAdminAuthedFromCookies())) {
    return { status: "error", message: "Nemáte oprávnenie uložiť prieskum." };
  }

  const agency = requiredFormString(formData.get("agency"));
  const publishedDate = requiredFormString(formData.get("publishedDate"));
  const resultRows = PARTY_LIST.flatMap((party) => {
    const raw = requiredFormString(formData.get(`result:${party.id}`));
    if (!raw) return [];

    const percentage = Number(raw);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return [];

    return [{ partyId: party.id, percentage }];
  });

  if (!agency || !publishedDate) {
    return { status: "error", message: "Vyplňte agentúru a dátum zverejnenia." };
  }

  if (resultRows.length === 0) {
    return { status: "error", message: "Zadajte aspoň jeden platný výsledok." };
  }

  const db = getDb();
  const now = new Date().toISOString();

  const [insertedPoll] = await db
    .insert(polls)
    .values({ agency, publishedDate, createdAt: now })
    .returning({ id: polls.id });

  await db.insert(pollResults).values(resultRows.map((row) => ({ ...row, pollId: insertedPoll.id })));
  revalidateCacheTag("polls");

  return { status: "success", message: "Prieskum bol uložený." };
}

function requiredFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
