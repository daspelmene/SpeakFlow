import type {
  SessionTemplate,
  SessionTemplatesByLearnerSlot,
} from "@/lib/sessionTemplateApi";

const STORAGE_PREFIX = "speakflow_session_ui_snapshot_v2";

type SessionUiSnapshot = {
  roomId: string;
  sessionTemplate?: SessionTemplate;
  learnerTemplates?: SessionTemplatesByLearnerSlot;
  savedAt: number;
};

function getStorageKey(roomId: string) {
  return `${STORAGE_PREFIX}_${roomId}`;
}

export function saveSessionUiSnapshot(
  roomId: string,
  sessionTemplate: SessionTemplate,
) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  const previousSnapshot = readSnapshot(roomId);

  const snapshot: SessionUiSnapshot = {
    roomId,
    sessionTemplate,
    learnerTemplates: previousSnapshot?.learnerTemplates,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(getStorageKey(roomId), JSON.stringify(snapshot));
}

export function getSessionUiSnapshot(roomId: string) {
  const snapshot = readSnapshot(roomId);

  return snapshot?.sessionTemplate ?? null;
}

export function saveLearnerSessionTemplates(
  roomId: string,
  learnerTemplates: SessionTemplatesByLearnerSlot,
) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  const previousSnapshot = readSnapshot(roomId);

  const snapshot: SessionUiSnapshot = {
    roomId,
    sessionTemplate: previousSnapshot?.sessionTemplate,
    learnerTemplates,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(getStorageKey(roomId), JSON.stringify(snapshot));
}

export function getLearnerSessionTemplates(roomId: string) {
  const snapshot = readSnapshot(roomId);

  return snapshot?.learnerTemplates ?? null;
}

function readSnapshot(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return null;
  }

  const raw = window.localStorage.getItem(getStorageKey(roomId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUiSnapshot>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(getStorageKey(roomId));
    return null;
  }
}

export function removeSessionUiSnapshot(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  window.localStorage.removeItem(getStorageKey(roomId));
}

const UNLOCKED_PREFIX = "speakflow_session_content_unlocked";

function getUnlockedStorageKey(roomId: string) {
  return `${UNLOCKED_PREFIX}_${roomId}`;
}

export function saveSessionContentUnlocked(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  window.localStorage.setItem(getUnlockedStorageKey(roomId), "true");
}

export function getSessionContentUnlocked(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return false;
  }

  return window.localStorage.getItem(getUnlockedStorageKey(roomId)) === "true";
}

export function removeSessionContentUnlocked(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  window.localStorage.removeItem(getUnlockedStorageKey(roomId));
}