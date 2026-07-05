import { getAuthHeaders, request } from "@/lib/api";

export type CreatorProfile = {
  user_id: number;
  fullname: string;
  native_language: string | null;
  target_language: string | null;
  interests: string[];
  bio: string | null;
};

export type CreateRoomResponse = {
  room_id: string;
  invited_user_id: number;
  invited_user_name: string;
};

export type RoomInvitation = {
  room_id: string;
  creator_user_id: number;
  creator_user_name: string;
  creator_profile: CreatorProfile | null;
};

export type PendingInvitationsResponse = {
  invitations: RoomInvitation[];
};

export type ActiveRoomResponse = {
  room_id: string;
  user_slot: string;
  role: string;
};

export type JoinRoomResponse = {
  room_id: string;
  user_slot: string;
  role: string;
};

export type MessageResponse = {
  message: string;
};

export function createRoom() {
  return request<CreateRoomResponse>("/api/v1/audio/create-room", {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export function getActiveRoom() {
  return request<ActiveRoomResponse | null>("/api/v1/audio/active-room", {
    method: "GET",
    headers: getAuthHeaders(),
  });
}

export function getPendingInvitations() {
  return request<PendingInvitationsResponse>(
    "/api/v1/audio/pending-invitations",
    {
      method: "GET",
      headers: getAuthHeaders(),
    },
  );
}

export function joinRoom(roomId: string) {
  return request<JoinRoomResponse>("/api/v1/audio/join-room", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      room_id: roomId,
    }),
  });
}

export function leaveRoom() {
  return request<MessageResponse>("/api/v1/audio/leave-room", {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export function declineInvitation(roomId: string) {
  return request<MessageResponse>("/api/v1/audio/decline-invitation", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      room_id: roomId,
    }),
  });
}
