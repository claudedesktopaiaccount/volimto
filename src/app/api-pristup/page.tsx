import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { apiKeys } from "@/lib/db/schema";
import { cookies } from "next/headers";
import ApiPristupClient from "./ApiPristupClient";

export const metadata: Metadata = {
  title: "API pr\u00EDstup",
  description:
    "Z\u00EDskajte pr\u00EDstup k VolímTo API pre v\u00FDvoj\u00E1rov, novin\u00E1rov a v\u00FDskumn\u00EDkov.",
};

export default async function ApiPristupPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  let userKeys: (typeof apiKeys.$inferSelect)[] = [];
  let userId: string | null = null;

  try {
    const db = getDb();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("volimto_session")?.value;
    if (sessionToken) {
      const session = await validateSession(sessionToken, db);
      if (session) {
        userId = session.userId;
        userKeys = await db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.userId, session.userId));
      }
    }
  } catch {
    // static build
  }

  const { upgraded } = await searchParams;
  return (
    <ApiPristupClient
      userKeys={userKeys}
      isLoggedIn={!!userId}
      justUpgraded={upgraded === "1"}
    />
  );
}
