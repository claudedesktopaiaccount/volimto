const STATIC_BUILD_PHASE = "phase-production-build";

export function isStaticBuild() {
  return process.env.NEXT_PHASE === STATIC_BUILD_PHASE;
}

export async function withTimeout<T>(
  label: string,
  load: () => Promise<T>,
  timeoutMs = 2500
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
