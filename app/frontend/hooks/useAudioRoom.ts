"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WSAudioClient } from "@/lib/wsAudio";
import { createAudioRoom, disconnectFromRoom } from "@/lib/audioApi";
import { getAccessToken } from "@/lib/auth";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type RoomStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "active"
  | "ended";

export type Participant = {
  slot: string;
  name: string;
  muted?: boolean;
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

  const update = useCallback((partial: Partial<AudioRoomState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const sendWs = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ------------------------------------------------------------------
  // Create room
  // ------------------------------------------------------------------

  const createRoom = useCallback(async () => {
    update({ status: "creating", error: null });

    try {
      const { roomId } = await createAudioRoom();
      roomIdRef.current = roomId;
      update({ roomId, status: "waiting" });
      await connectToRoom(roomId);
    } catch (err) {
      update({
        error: err instanceof Error ? err.message : "Failed to create room",
        status: "idle",
      });
    }
  }, [update]);

  // ------------------------------------------------------------------
  // Join existing room
  // ------------------------------------------------------------------

  const joinRoom = useCallback(async (roomId: string) => {
    roomIdRef.current = roomId;
    update({ status: "waiting", roomId, error: null });
    await connectToRoom(roomId);
  }, [update]);

  // ------------------------------------------------------------------
  // Connect to room via WebSocket
  // ------------------------------------------------------------------

  const connectToRoom = useCallback(async (roomId: string) => {
    const token = getAccessToken();
    if (!token) {
      update({ error: "Not authenticated", status: "idle" });
      return;
    }

    const wsAudio = new WSAudioClient();
    wsAudioRef.current = wsAudio;

    try {
      await wsAudio.startMicrophone();
      update({ isMuted: wsAudio.isMuted });

      wsAudio.onAudioData = (buffer: ArrayBuffer) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(buffer);
        }
      };

      // Build WebSocket URL
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL;
      let wsUrl: string;
      if (wsBaseUrl) {
        wsUrl = `${wsBaseUrl}/api/v1/audio/ws/${roomId}?token=${encodeURIComponent(token)}`;
      } else {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = window.location.host;
        wsUrl = `${wsProtocol}//${wsHost}/api/v1/audio/ws/${roomId}?token=${encodeURIComponent(token)}`;
      }

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[AudioRoom] WebSocket connected");
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === "string") {
          try {
            const data = JSON.parse(event.data);
            const msgType = data.type;

            switch (msgType) {
              case "room-state": {
                const slot = data.userSlot as string;
                userSlotRef.current = slot;
                const participants: Participant[] = data.participants || [];
                
                console.log(`[AudioRoom] Room state: slot=${slot}, participants=${participants.length}`);

                // Start playback BEFORE updating state to ensure it's ready
                const audioEl = await wsAudio.startPlayback();
                await wsAudio.waitForPlaybackReady();
                
                update({ 
                  remoteAudioElement: audioEl,
                  roomId: data.roomId,
                  userSlot: slot,
                  participants,
                  status: participants.length > 1 ? "active" : "waiting",
                });
                break;
              }

              case "user-joined": {
                // Restart MediaRecorder to generate fresh WebM header for new participant
                wsAudio.restartMediaRecorder();
                
                setState((prev) => ({
                  ...prev,
                  participants: [
                    ...prev.participants,
                    { slot: data.userSlot, name: data.userName },
                  ],
                  status: "active",
                }));
                console.log(`[AudioRoom] User joined: ${data.userName}`);
                break;
              }

              case "user-left": {
                setState((prev) => ({
                  ...prev,
                  participants: prev.participants.filter(
                    (p) => p.slot !== data.userSlot
                  ),
                  status: "ended",
                }));
                break;
              }

              case "mute": {
                setState((prev) => ({
                  ...prev,
                  participants: prev.participants.map((p) =>
                    p.slot === data.userSlot
                      ? { ...p, muted: data.muted }
                      : p
                  ),
                }));
                break;
              }

              case "error": {
                update({ error: data.message, status: "idle" });
                break;
              }
            }
          } catch (err) {
            console.error("[AudioRoom] Message error:", err);
          }
        } else {
          // Binary audio data
          wsAudio.handleRemoteAudio(event.data as ArrayBuffer);
        }
      };

      ws.onclose = () => {
        console.log("[AudioRoom] WebSocket closed");
        setState((prev) => ({
          ...prev,
          status: prev.status === "idle" ? "idle" : "ended",
        }));
      };

      ws.onerror = () => {
        console.error("[AudioRoom] WebSocket error");
        update({ error: "Connection error", status: "idle" });
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      update({ error: message, status: "idle" });
      wsAudio.close();
    }
  }, [sendWs, update]);

  // ------------------------------------------------------------------
  // Toggle mute
  // ------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    const wsAudio = wsAudioRef.current;
    if (wsAudio) {
      const muted = wsAudio.toggleMute();
      update({ isMuted: muted });
      sendWs({ type: "mute", muted });
    }
  }, [update, sendWs]);

  // ------------------------------------------------------------------
  // Leave room
  // ------------------------------------------------------------------

  const leaveRoom = useCallback(async () => {
    wsAudioRef.current?.close();
    wsAudioRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (roomIdRef.current) {
      try {
        await disconnectFromRoom(roomIdRef.current);
      } catch {
        // Ignore
      }
    }

    userSlotRef.current = null;
    roomIdRef.current = null;

    update({
      status: "idle",
      roomId: null,
      userSlot: null,
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
      if (wsRef.current) wsRef.current.close();
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