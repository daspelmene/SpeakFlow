import type { UserMe } from "@/lib/api";

export function isProfileComplete(user: UserMe) {
  return Boolean(
    user.native_language &&
      user.target_language &&
      user.interests.length > 0 &&
      user.bio?.trim(),
  );
}