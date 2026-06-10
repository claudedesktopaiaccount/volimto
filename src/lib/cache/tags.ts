import { revalidateTag } from "next/cache";

export function revalidateCacheTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch (error) {
    const isVitestContextError =
      process.env.NODE_ENV === "test" &&
      error instanceof Error &&
      error.message.includes("static generation store missing");

    if (!isVitestContextError) {
      throw error;
    }
  }
}
