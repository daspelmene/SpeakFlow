"use client";

import { useEffect, useRef } from "react";

import {
  useAudioRoom,
  type Participant,
  type RoomStatus,
  type SessionRole,
} from "@/hooks/useAudioRoom";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type AudioRoomStateSnapshot = {
  status: RoomStatus;
  roomId: string | null;
  userSlot: string | null;
  role: SessionRole | null;
  participants: Participant[];
};

type AudioRoomProps = {
  initialRoomId?: string;
  showRoomCode?: boolean;
  onEnd?: () => void;
  onRoomStateChange?: (state: AudioRoomStateSnapshot) => void;
};

const statusLabels: Record<RoomStatus, string> = {
  idle: "Not connected",
  creating: "Creating room",
  connecting: "Connecting",
  waiting: "Waiting for partner",
  active: "Active call",
  ended: "Finished",
};

const statusClasses: Record<RoomStatus, string> = {
  idle: "bg-slate-100 text-slate-600",
  creating: "bg-amber-100 text-amber-700",
  connecting: "bg-indigo-100 text-indigo-700",
  waiting: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  ended: "bg-slate-100 text-slate-600",
};

function getParticipantLabel(participant: Participant) {
  if (participant.name) {
    return participant.name;
  }

  return participant.slot === "user1" ? "Room creator" : "Invited partner";
}

export default function AudioRoom({
  initialRoomId,
  showRoomCode = true,
  onEnd,
  onRoomStateChange,
}: AudioRoomProps) {
  const {
    status,
    roomId,
    userSlot,
    role,
    participants,
    isMuted,
    error,
    remoteAudioElement,
    joinRoom,
    leaveRoom,
    toggleMute,
    switchRoles,
  } = useAudioRoom();

  const hasAutoJoinedRef = useRef(false);

  useEffect(() => {
    if (!initialRoomId || hasAutoJoinedRef.current || status !== "idle") {
      return;
    }

    hasAutoJoinedRef.current = true;
    void joinRoom(initialRoomId);
  }, [initialRoomId, joinRoom, status]);

  useEffect(() => {
    onRoomStateChange?.({
      status,
      roomId,
      userSlot,
      role,
      participants,
    });
  }, [status, roomId, userSlot, role, participants, onRoomStateChange]);

  useEffect(() => {
    if (status === "ended") {
      onEnd?.();
    }
  }, [status, onEnd]);

  useEffect(() => {
    if (remoteAudioElement) {
      remoteAudioElement.play().catch(() => {
        // Browser may block autoplay until user interaction.
      });
    }
  }, [remoteAudioElement]);

  const canUseMicrophone =
    status === "waiting" || status === "active" || status === "connecting";

  const canLeaveRoom =
    status === "waiting" || status === "active" || status === "connecting";

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Audio room
          </h2>

          <p className="mt-2 text-base leading-7 text-slate-600">
            SpeakFlow uses a WebSocket audio room for live speaking practice.
          </p>
        </div>

        <span
          className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${
            statusClasses[status]
          }`}
        >
          {statusLabels[status]}
        </span>
      </div>

      {showRoomCode && roomId && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Room ID
          </p>

          <p className="mt-1 break-all font-mono text-lg font-black text-slate-950">
            {roomId}
          </p>
        </div>
      )}

      {participants.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-black uppercase tracking-wide text-slate-400">
            Participants
          </p>

          {participants.map((participant) => (
            <div
              key={participant.slot}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-base font-black text-slate-900">
                  {getParticipantLabel(participant)}
                </p>

                <p className="text-sm font-bold text-slate-500">
                  {participant.slot}
                  {participant.slot === userSlot ? " · you" : ""}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  participant.muted
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {participant.muted ? "Muted" : "Microphone active"}
              </span>
            </div>
          ))}
        </div>
      )}

      {status === "waiting" && (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold leading-6 text-amber-800">
            Waiting for the invited partner to join. Guided session content will
            appear after both participants are connected.
          </p>
        </div>
      )}

      {status === "ended" && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold leading-6 text-slate-700">
            This room has ended. You can return to the dashboard using the top
            navigation.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold leading-6 text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {canUseMicrophone && (
          <Button type="button" variant="secondary" onClick={toggleMute}>
            {isMuted ? "Unmute microphone" : "Mute microphone"}
          </Button>
        )}
        {status === "active" && (
          <Button type="button" variant="secondary" onClick={switchRoles}>
            Switch roles
          </Button>
        )}
        {canLeaveRoom && (
          <Button type="button" variant="danger" onClick={() => void leaveRoom()}>
            Leave room
          </Button>
        )}
      </div>
    </Card>
  );
}