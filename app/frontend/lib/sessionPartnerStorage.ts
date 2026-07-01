const STORAGE_KEY = "speakflow_session_partner_map";

type SessionPartnerMap = Record<string, number>;

function readMap(): SessionPartnerMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as SessionPartnerMap;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeMap(map: SessionPartnerMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function saveSessionPartnerUserId(roomId: string, partnerUserId: number) {
  if (!roomId || !Number.isFinite(partnerUserId) || partnerUserId <= 0) {
    return;
  }

  const map = readMap();

  map[roomId] = partnerUserId;

  writeMap(map);
}

export function getSessionPartnerUserId(roomId: string) {
  const map = readMap();

  return map[roomId] ?? null;
}

export function removeSessionPartnerUserId(roomId: string) {
  const map = readMap();

  delete map[roomId];

  writeMap(map);
}