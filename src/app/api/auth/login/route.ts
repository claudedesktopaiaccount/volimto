import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Prihlásenie e-mailom a heslom je vypnuté. Použite Google prihlásenie." },
    { status: 410 }
  );
}
