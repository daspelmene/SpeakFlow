"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { removeActiveRoomId, saveActiveRoomId } from "@/lib/activeRoomStorage";
import { getAccessToken } from "@/lib/auth";
import { createRoom as createRoomApi, leaveRoom as leaveCurrentRoom } from "@/lib/roomApi";
import { WSAudioClient } from "@/lib/wsAudio";

// Keepalive: proxies (e.g. the ingress) silently drop idle WebSockets,
// which kills audio after a long mute or while waiting alone in a room.
// The client pings periodically; a missing pong means the connection is
// dead and we must reconnect.
const PING_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 45_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1_000;

// Roles rotate automatically so both partners take turns as helper/learner.
// Only one side (the creator, user1) drives the timer — if both sent
// switch-roles every interval the two swaps would cancel out.
const ROLE_SWITCH_INTERVAL_MS = 90_000;

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

export type SessionRole = "helper" | "learner";

export type AudioRoomState = {
  status: RoomStatus;
  roomId: string | null;
  userSlot: string | null;
  role: SessionRole | null;
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

function normalizeRole(rawRole: unknown): SessionRole | null {
  return rawRole === "helper" || rawRole === "learner" ? rawRole : null;
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
    role: null,
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

  const heartbeatIntervalRef = useRef<number | null>(null);
  const lastPongRef = useRef(0);
  const manualCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectToRoomRef = useRef<((roomId: string) => Promise<void>) | null>(
    null,
  );

  const update = useCallback((partial: Partial<AudioRoomState>) => {
    setState((previousState) => ({ ...previousState, ...partial }));
  }, []);

  const sendWs = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ------------------------------------------------------------------
  // Keepalive heartbeat
  // ------------------------------------------------------------------

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current !== null) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      stopHeartbeat();

      lastPongRef.current = Date.now();

      heartbeatIntervalRef.current = window.setInterval(() => {
        if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) {
          stopHeartbeat();
          return;
        }

        if (Date.now() - lastPongRef.current > PONG_TIMEOUT_MS) {
          console.warn(
            "[AudioRoom] Heartbeat timed out, closing stale WebSocket",
          );

          stopHeartbeat();
          // Triggers onclose, which schedules a reconnect.
          ws.close();
          return;
        }

        ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      }, PING_INTERVAL_MS);
    },
    [stopHeartbeat],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
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

      manualCloseRef.current = false;
      clearReconnectTimer();
      stopHeartbeat();

      wsAudioRef.current?.close();

      if (wsRef.current) {
        // Detach handlers so closing the old socket does not trigger
        // the reconnect logic in its onclose.
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
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
          startHeartbeat(ws);
        };

        ws.onmessage = async (event) => {
          // Any inbound frame proves the connection is alive.
          lastPongRef.current = Date.now();

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
                    role: normalizeRole(data.role),
                    participants:
                      participants.length > 0
                        ? participants
                        : slot
                          ? [{ slot, name: userName, muted: wsAudio.isMuted }]
                          : [],
                    status: participants.length > 1 ? "active" : "waiting",
                  });

                  saveActiveRoomId(roomId);

                  reconnectAttemptsRef.current = 0;

                  // After a reconnect the server keeps the pre-disconnect
                  // mute flag; re-sync our actual state.
                  sendWs({ type: "mute", muted: wsAudio.isMuted });

                  console.log("[AudioRoom] Room state received", {
                    slot,
                    participants: participants.length,
                  });

                  break;
                }

                case "pong": {
                  break;
                }

                case "peer-reconnected": {
                  const peerSlot =
                    typeof data.userSlot === "string" ? data.userSlot : null;

                  if (!peerSlot) {
                    return;
                  }

                  const peerName =
                    typeof data.userName === "string"
                      ? data.userName
                      : "Participant";

                  const peerMuted =
                    typeof data.muted === "boolean" ? data.muted : false;

                  // The peer restarts its recorder from scratch, so our
                  // playback pipeline must start from a fresh WebM header too.
                  const audioElement = await wsAudio.resetPlayback();

                  update({ remoteAudioElement: audioElement });

                  wsAudio.restartMediaRecorder();

                  setState((previousState) => {
                    const participantExists = previousState.participants.some(
                      (participant) => participant.slot === peerSlot,
                    );

                    const nextParticipants = participantExists
                      ? previousState.participants.map((participant) =>
                          participant.slot === peerSlot
                            ? { ...participant, name: peerName, muted: peerMuted }
                            : participant,
                        )
                      : [
                          ...previousState.participants,
                          { slot: peerSlot, name: peerName, muted: peerMuted },
                        ];

                    return {
                      ...previousState,
                      participants: nextParticipants,
                      status: "active",
                    };
                  });

                  console.log("[AudioRoom] Peer reconnected:", peerName);
                  break;
                }

                case "audio-restart-required": {
                  const audioElement = await wsAudio.resetPlayback();

                  update({ remoteAudioElement: audioElement });

                  wsAudio.restartMediaRecorder();

                  console.log(
                    "[AudioRoom] Audio pipelines restarted after reconnect",
                  );

                  break;
                }

                case "roles-updated": {
                  const nextRole = normalizeRole(data.yourRole);

                  if (nextRole) {
                    update({ role: nextRole });
                    console.log("[AudioRoom] Role updated:", nextRole);
                  }

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

          stopHeartbeat();

          const roomWasClosedByBackend =
            event.code === 4000 || event.reason === "Room closed";

          const roomWasRejected =
            event.code === 4004 ||
            event.reason.toLowerCase().includes("room not found");

          const authFailed = event.code === 4001;

          // Unexpected drop (proxy idle timeout, network blip, heartbeat
          // kill): reconnect. The server keeps our slot for a grace period
          // and restores the session on reconnect.
          const shouldReconnect =
            !manualCloseRef.current &&
            !roomWasClosedByBackend &&
            !roomWasRejected &&
            !authFailed;

          if (shouldReconnect) {
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current += 1;

              const delay =
                RECONNECT_BASE_DELAY_MS *
                2 ** (reconnectAttemptsRef.current - 1);

              console.log("[AudioRoom] Scheduling reconnect", {
                attempt: reconnectAttemptsRef.current,
                delay,
              });

              update({ status: "connecting" });

              reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null;
                connectToRoomRef.current?.(roomId);
              }, delay);

              return;
            }

            update({
              error: "Connection lost. Please rejoin the room.",
              status: "ended",
            });

            return;
          }

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
          // onclose always follows and decides whether to reconnect.
          console.warn("[AudioRoom] WebSocket error", event);
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to connect";

        update({ error: message, status: "idle" });
        wsAudio.close();
      }
    },
    [clearReconnectTimer, sendWs, startHeartbeat, stopHeartbeat, update],
  );

  useEffect(() => {
    connectToRoomRef.current = connectToRoom;
  }, [connectToRoom]);

  // ------------------------------------------------------------------
  // Automatic role rotation
  // ------------------------------------------------------------------
  // While the call is active, roles rotate every ROLE_SWITCH_INTERVAL_MS so
  // both partners take turns being helper and learner. Only the creator
  // (user1) drives the timer; the backend swaps both roles and notifies
  // each side via a "roles-updated" event.

  useEffect(() => {
    if (state.status !== "active" || state.userSlot !== "user1") {
      return;
    }

    const intervalId = window.setInterval(() => {
      sendWs({ type: "switch-roles" });
      console.log("[AudioRoom] Requested automatic role switch");
    }, ROLE_SWITCH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.status, state.userSlot, sendWs]);

  // ------------------------------------------------------------------
  // Create room through new backend flow
  // ------------------------------------------------------------------

  const createRoom = useCallback(async () => {
    update({ status: "creating", error: null });

    try {
      const match = await createRoomApi();
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

    manualCloseRef.current = true;
    clearReconnectTimer();
    stopHeartbeat();

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
      role: null,
      participants: [],
      isMuted: true,
      error: null,
      remoteAudioElement: null,
    });
  }, [clearReconnectTimer, stopHeartbeat, update]);

  // ------------------------------------------------------------------
  // Cleanup on unmount
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

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