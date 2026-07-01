"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { removeActiveRoomId, saveActiveRoomId } from "@/lib/activeRoomStorage";
import { getAccessToken } from "@/lib/auth";
import { findMatch, leaveRoom as leaveCurrentRoom } from "@/lib/roomApi";
import { WSAudioClient } from "@/lib/wsAudio";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type RoomStatus =
  | "idle"
  | "creating"
  | "connecting"
  | "waiting"
  | "active"
  | "ended";

export type Participant = {
  slot: string;
  name: string;
  muted?: boolean;
  userId?: number;
};

export type AudioRoomState = {
  status: RoomStatus;
  roomId: string | null;
  userSlot: string | null;
  participants: Participant[];
  isMuted: boolean;
  error: string | null;
  remoteAudioElement: HTMLAudioElement | null;
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function normalizeParticipant(rawParticipant: unknown): Participant | null {
  if (!rawParticipant || typeof rawParticipant !== "object") {
    return null;
  }

  const participant = rawParticipant as Record<string, unknown>;

  const slot =
    typeof participant.slot === "string"
      ? participant.slot
      : typeof participant.userSlot === "string"
        ? participant.userSlot
        : null;

  if (!slot) {
    return null;
  }

  const name =
    typeof participant.name === "string"
      ? participant.name
      : typeof participant.userName === "string"
        ? participant.userName
        : slot;

  const muted =
    typeof participant.muted === "boolean" ? participant.muted : false;

  const rawUserId = participant.userId ?? participant.user_id;
  const userId =
    typeof rawUserId === "number"
      ? rawUserId
      : typeof rawUserId === "string"
        ? Number(rawUserId)
        : undefined;

  return {
    slot,
    name,
    muted,
    userId: Number.isFinite(userId) ? userId : undefined,
  };
}

function normalizeParticipants(rawParticipants: unknown): Participant[] {
  if (!Array.isArray(rawParticipants)) {
    return [];
  }

  return rawParticipants
    .map(normalizeParticipant)
    .filter((participant): participant is Participant => participant !== null);
}

function buildWebSocketUrl(roomId: string, token: string) {
  const encodedToken = encodeURIComponent(token);
  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;

  if (wsBaseUrl) {
    return `${wsBaseUrl}/api/v1/audio/ws/${roomId}?token=${encodedToken}`;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = window.location.host;

  return `${wsProtocol}//${wsHost}/api/v1/audio/ws/${roomId}?token=${encodedToken}`;
}

// ------------------------------------------------------------------
// Hook
// ------------------------------------------------------------------

export function useAudioRoom() {
  const [state, setState] = useState<AudioRoomState>({
    status: "idle",
    roomId: null,
    userSlot: null,
    participants: [],
    isMuted: true,
    error: null,
    remoteAudioElement: null,
  });

  const wsAudioRef = useRef<WSAudioClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userSlotRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const sentBinaryFramesRef = useRef(0);
  const receivedBinaryFramesRef = useRef(0);

  const update = useCallback((partial: Partial<AudioRoomState>) => {
    setState((previousState) => ({ ...previousState, ...partial }));
  }, []);

  const sendWs = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ------------------------------------------------------------------
  // Connect to room via WebSocket
  // ------------------------------------------------------------------

  const connectToRoom = useCallback(
    async (roomId: string) => {
      const token = getAccessToken();

      if (!token) {
        update({ error: "Not authenticated", status: "idle" });
        return;
      }

      wsAudioRef.current?.close();

      if (wsRef.current) {
        wsRef.current.close();
      }

      sentBinaryFramesRef.current = 0;
      receivedBinaryFramesRef.current = 0;

      const wsAudio = new WSAudioClient();
      wsAudioRef.current = wsAudio;

      try {
        update({ status: "connecting", error: null });

        await wsAudio.startMicrophone();
        update({ isMuted: wsAudio.isMuted });

        wsAudio.onAudioData = (buffer: ArrayBuffer) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            sentBinaryFramesRef.current += 1;

            if (
              sentBinaryFramesRef.current === 1 ||
              sentBinaryFramesRef.current % 50 === 0
            ) {
              console.log("[AudioRoom] Sending binary frame", {
                count: sentBinaryFramesRef.current,
                bytes: buffer.byteLength,
              });
            }

            wsRef.current.send(buffer);
          }
        };

        const wsUrl = buildWebSocketUrl(roomId, token);
        const ws = new WebSocket(wsUrl);

        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[AudioRoom] WebSocket connected");
        };

        ws.onmessage = async (event) => {
          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data) as Record<string, unknown>;
              const msgType = data.type;

              switch (msgType) {
                case "room-state": {
                  const slot =
                    typeof data.userSlot === "string" ? data.userSlot : null;

                  const userName =
                    typeof data.userName === "string"
                      ? data.userName
                      : "Participant";

                  const participants = normalizeParticipants(data.participants);

                  userSlotRef.current = slot;

                  const audioElement = await wsAudio.startPlayback();
                  await wsAudio.waitForPlaybackReady();

                  update({
                    remoteAudioElement: audioElement,
                    roomId:
                      typeof data.roomId === "string" ? data.roomId : roomId,
                    userSlot: slot,
                    participants:
                      participants.length > 0
                        ? participants
                        : slot
                          ? [{ slot, name: userName, muted: wsAudio.isMuted }]
                          : [],
                    status: participants.length > 1 ? "active" : "waiting",
                  });

                  saveActiveRoomId(roomId);

                  console.log("[AudioRoom] Room state received", {
                    slot,
                    participants: participants.length,
                  });

                  break;
                }

                case "user-joined": {
                  const joinedSlot =
                    typeof data.userSlot === "string" ? data.userSlot : null;

                  if (!joinedSlot) {
                    return;
                  }

                  const joinedName =
                    typeof data.userName === "string"
                      ? data.userName
                      : "Participant";

                  const rawUserId = data.userId ?? data.user_id;
                  const joinedUserId =
                    typeof rawUserId === "number"
                      ? rawUserId
                      : typeof rawUserId === "string"
                        ? Number(rawUserId)
                        : undefined;

                  const audioElement = await wsAudio.resetPlayback();

                  update({
                    remoteAudioElement: audioElement,
                  });

                  wsAudio.restartMediaRecorder();

                  setState((previousState) => {
                    const participantExists = previousState.participants.some(
                      (participant) => participant.slot === joinedSlot,
                    );

                    const nextParticipants = participantExists
                      ? previousState.participants.map((participant) =>
                          participant.slot === joinedSlot
                            ? {
                                ...participant,
                                name: joinedName,
                                userId: Number.isFinite(joinedUserId)
                                  ? joinedUserId
                                  : participant.userId,
                              }
                            : participant,
                        )
                      : [
                          ...previousState.participants,
                          {
                            slot: joinedSlot,
                            name: joinedName,
                            muted: false,
                            userId: Number.isFinite(joinedUserId)
                              ? joinedUserId
                              : undefined,
                          },
                        ];

                    return {
                      ...previousState,
                      participants: nextParticipants,
                      status: "active",
                    };
                  });

                  console.log("[AudioRoom] User joined:", joinedName);
                  break;
                }

                case "user-left": {
                  const leftSlot =
                    typeof data.userSlot === "string" ? data.userSlot : null;

                  setState((previousState) => ({
                    ...previousState,
                    participants: leftSlot
                      ? previousState.participants.filter(
                          (participant) => participant.slot !== leftSlot,
                        )
                      : previousState.participants,
                    status: "ended",
                  }));

                  removeActiveRoomId();
                  break;
                }

                case "mute": {
                  const mutedSlot =
                    typeof data.userSlot === "string" ? data.userSlot : null;

                  const muted =
                    typeof data.muted === "boolean" ? data.muted : false;

                  if (!mutedSlot) {
                    return;
                  }

                  setState((previousState) => ({
                    ...previousState,
                    participants: previousState.participants.map(
                      (participant) =>
                        participant.slot === mutedSlot
                          ? { ...participant, muted }
                          : participant,
                    ),
                  }));

                  break;
                }

                case "error": {
                  const message =
                    typeof data.message === "string"
                      ? data.message
                      : "Audio room error";

                  if (message.toLowerCase().includes("room not found")) {
                    removeActiveRoomId();
                  }

                  update({
                    error: message,
                    status: "ended",
                  });

                  break;
                }

                default:
                  console.warn("[AudioRoom] Unknown message:", data);
              }
            } catch (error) {
              console.error("[AudioRoom] Message error:", error);
            }

            return;
          }

          receivedBinaryFramesRef.current += 1;

          if (
            receivedBinaryFramesRef.current === 1 ||
            receivedBinaryFramesRef.current % 50 === 0
          ) {
            console.log("[AudioRoom] Received binary frame", {
              count: receivedBinaryFramesRef.current,
              bytes: (event.data as ArrayBuffer).byteLength,
            });
          }

          wsAudio.handleRemoteAudio(event.data as ArrayBuffer);
        };

        ws.onclose = (event) => {
          console.log("[AudioRoom] WebSocket closed", {
            code: event.code,
            reason: event.reason,
          });

          const roomWasClosedByBackend =
            event.code === 4000 || event.reason === "Room closed";

          const roomWasRejected =
            event.code === 4004 ||
            event.reason.toLowerCase().includes("room not found");

          if (roomWasClosedByBackend || roomWasRejected) {
            removeActiveRoomId();
          }

          setState((previousState) => ({
            ...previousState,
            status:
              previousState.status === "idle" ||
              previousState.status === "ended"
                ? previousState.status
                : "ended",
            error: roomWasRejected
              ? event.reason || "Room not found"
              : previousState.error,
          }));
        };

        ws.onerror = (event) => {
          console.warn("[AudioRoom] WebSocket error", event);
          update({ error: "Connection error", status: "idle" });
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to connect";

        update({ error: message, status: "idle" });
        wsAudio.close();
      }
    },
    [update],
  );

  // ------------------------------------------------------------------
  // Create room through new backend flow
  // ------------------------------------------------------------------

  const createRoom = useCallback(async () => {
    update({ status: "creating", error: null });

    try {
      const match = await findMatch();
      const roomId = match.room_id;

      roomIdRef.current = roomId;
      saveActiveRoomId(roomId);

      update({ roomId, status: "waiting" });

      await connectToRoom(roomId);
    } catch (error) {
      update({
        error:
          error instanceof Error ? error.message : "Failed to create room",
        status: "idle",
      });
    }
  }, [connectToRoom, update]);

  // ------------------------------------------------------------------
  // Join existing room
  // ------------------------------------------------------------------

  const joinRoom = useCallback(
    async (roomId: string) => {
      const normalizedRoomId = roomId.trim();

      if (!normalizedRoomId) {
        update({ error: "Room code is required." });
        return;
      }

      roomIdRef.current = normalizedRoomId;
      saveActiveRoomId(normalizedRoomId);

      update({
        status: "connecting",
        roomId: normalizedRoomId,
        error: null,
      });

      await connectToRoom(normalizedRoomId);
    },
    [connectToRoom, update],
  );

  // ------------------------------------------------------------------
  // Toggle mute
  // ------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    const wsAudio = wsAudioRef.current;

    if (!wsAudio) {
      update({ error: "Microphone is not ready yet." });
      return;
    }

    const muted = wsAudio.toggleMute();

    update({ isMuted: muted });
    sendWs({ type: "mute", muted });

    const currentUserSlot = userSlotRef.current;

    if (currentUserSlot) {
      setState((previousState) => ({
        ...previousState,
        participants: previousState.participants.map((participant) =>
          participant.slot === currentUserSlot
            ? { ...participant, muted }
            : participant,
        ),
      }));
    }
  }, [sendWs, update]);

  // ------------------------------------------------------------------
  // Leave room
  // ------------------------------------------------------------------

  const leaveRoom = useCallback(async () => {
    const currentRoomId = roomIdRef.current;
    const currentUserSlot = userSlotRef.current;

    wsAudioRef.current?.close();
    wsAudioRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      await leaveCurrentRoom();
    } catch {
      // The backend may already have deleted the room after disconnect.
      // We still keep the local frontend in a finished state.
    }

    removeActiveRoomId();

    userSlotRef.current = null;
    roomIdRef.current = null;

    update({
      status: "ended",
      roomId: currentRoomId,
      userSlot: currentUserSlot,
      participants: [],
      isMuted: true,
      error: null,
      remoteAudioElement: null,
    });
  }, [update]);

  // ------------------------------------------------------------------
  // Cleanup on unmount
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      wsAudioRef.current?.close();

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleMute,
  };
}