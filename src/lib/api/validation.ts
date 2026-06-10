export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function readJsonObject(request: Request): Promise<ValidationResult<Record<string, unknown>>> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return { ok: false, error: "invalid_body" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "invalid_body" };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    result[key] = item;
  }

  return result;
}

export function boundedInteger(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}
