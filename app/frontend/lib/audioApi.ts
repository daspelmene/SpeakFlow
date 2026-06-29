/**
 * REST API client for SpeakFlow audio room management.
 *
 * Audio streaming goes through WebSocket — see useAudioRoom hook.
 */

import { getAuthHeaders, request } from "@/lib/api";

// --- Types ---

export type CreateRoomResponse = {
  roomId: string;
};

export type AvailableRoom = {
  roomId: string;
  userName: string;
  created: string;
};

export type AvailableRoomsResponse = {
  rooms: AvailableRoom[];
};

// --- API calls ---

export function createAudioRoom(): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/v1/audio/create-room", {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export function getAvailableRooms(): Promise<AvailableRoomsResponse> {
  return request<AvailableRoomsResponse>("/api/v1/audio/available-rooms", {
    method: "GET",
    headers: getAuthHeaders(),
  });
}

export function disconnectFromRoom(roomId: string): Promise<{ status: string }> {
  return request<{ status: string }>("/api/v1/audio/disconnect", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ roomId }),
  });
}
