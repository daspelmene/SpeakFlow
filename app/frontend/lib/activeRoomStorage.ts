const ACTIVE_ROOM_ID_KEY = "speakflow_active_room_id";

export function saveActiveRoomId(roomId: string) {
  if (typeof window === "undefined" || !roomId) {
    return;
  }

  window.localStorage.setItem(ACTIVE_ROOM_ID_KEY, roomId);
}

export function getActiveRoomId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_ROOM_ID_KEY);
}

export function removeActiveRoomId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_ROOM_ID_KEY);
}