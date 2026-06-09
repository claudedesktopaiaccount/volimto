import type { Metadata } from "next";
import PrihlasenieClient from "./PrihlasenieClient";

export const metadata: Metadata = {
  title: "Prihlásenie — VolímTo",
  description: "Prihláste sa do svojho účtu na VolímTo.",
};

function safeNextPath(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

export default async function PrihlaseniePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <PrihlasenieClient nextPath={safeNextPath(next)} />;
}
