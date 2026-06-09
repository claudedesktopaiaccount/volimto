import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Registrácia e-mailom a heslom je vypnutá. Použite Google prihlásenie." },
    { status: 410 }
  );
}
