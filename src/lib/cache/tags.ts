import { revalidateTag } from "next/cache";

type RevalidationProfile = "max" | { expire?: number };

export function revalidateCacheTag(
  tag: string,
  profile: RevalidationProfile = "max"
) {
  try {
    revalidateTag(tag, profile);
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
