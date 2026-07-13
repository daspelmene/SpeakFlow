import { getAccessToken } from "@/lib/auth";

export const OPEN_ONBOARDING_TUTORIAL_EVENT =
  "speakflow-open-onboarding-tutorial";

const TUTORIAL_STORAGE_KEY_PREFIX = "speakflow_onboarding_tutorial_v1";

function getCurrentUserId() {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  try {
    const payloadSegment = token.split(".")[1];

    if (!payloadSegment) {
      return null;
    }

    const normalizedPayload = payloadSegment
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");

    const payload = JSON.parse(window.atob(normalizedPayload)) as {
      sub?: string | number;
    };

    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

function getTutorialStorageKey() {
  const userId = getCurrentUserId();

  return userId
    ? `${TUTORIAL_STORAGE_KEY_PREFIX}:${userId}`
    : `${TUTORIAL_STORAGE_KEY_PREFIX}:browser`;
}

export function hasCompletedOnboardingTutorial() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(getTutorialStorageKey()) === "completed";
}

export function markOnboardingTutorialCompleted() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(getTutorialStorageKey(), "completed");
}

export function openOnboardingTutorial() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(OPEN_ONBOARDING_TUTORIAL_EVENT));
}
