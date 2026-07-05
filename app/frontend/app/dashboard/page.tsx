"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  createRoom,
  declineInvitation,
  getActiveRoom,
  getPendingInvitations,
  joinRoom,
  type RoomInvitation,
} from "@/lib/roomApi";
import { getAccessToken } from "@/lib/auth";
import { removeActiveRoomId, saveActiveRoomId } from "@/lib/activeRoomStorage";
import { saveSessionPartnerUserId } from "@/lib/sessionPartnerStorage";
import {
  getLiveCorrectionNotes,
  getSessionFeedback,
  type LiveCorrectionNote,
  type SessionFeedback,
} from "@/lib/sessionActivityApi";

function formatShortRoomId(roomId: string) {
  return roomId.length > 12 ? `${roomId.slice(0, 8)}...` : roomId;
}

function isActiveRoomConflict(message: string) {
  return message.toLowerCase().includes("active room");
}

function InvitationCard({
  invitation,
  isJoining,
  isDeclining,
  onJoin,
  onDecline,
}: {
  invitation: RoomInvitation;
  isJoining: boolean;
  isDeclining: boolean;
  onJoin: (invitation: RoomInvitation) => void;
  onDecline: (invitation: RoomInvitation) => void;
}) {
  return (
    <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="warning">Incoming invitation</Badge>

          <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
            {invitation.creator_user_name} invited you
          </h3>

          <p className="mt-2 text-base leading-7 text-slate-600">
            Join this room to start an audio-only guided speaking session.
          </p>

          {invitation.creator_profile && (
            <div className="mt-4 flex flex-wrap gap-2">
              {invitation.creator_profile.native_language && (
                <Badge variant="neutral">
                  Speaks {invitation.creator_profile.native_language}
                </Badge>
              )}

              {invitation.creator_profile.target_language && (
                <Badge variant="neutral">
                  Learning {invitation.creator_profile.target_language}
                </Badge>
              )}
            </div>
          )}

          {invitation.creator_profile?.bio && (
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {invitation.creator_profile.bio}
            </p>
          )}

          <div className="mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-amber-100">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Room ID
            </p>

            <p className="mt-1 break-all text-base font-black text-slate-900">
              {formatShortRoomId(invitation.room_id)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button
            type="button"
            onClick={() => onJoin(invitation)}
            disabled={isJoining || isDeclining}
          >
            {isJoining ? "Joining..." : "Join room"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => onDecline(invitation)}
            disabled={isJoining || isDeclining}
          >
            {isDeclining ? "Declining..." : "Decline"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviousSessionsPreview({
  notes,
  feedbackItems,
  isLoading,
}: {
  notes: LiveCorrectionNote[];
  feedbackItems: SessionFeedback[];
  isLoading: boolean;
}) {
  const hasHistory = notes.length > 0 || feedbackItems.length > 0;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="neutral">Previous sessions</Badge>

          <h2 className="mt-4 text-2xl font-black text-slate-950">
            Practice history
          </h2>

          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
            Review correction notes and feedback from completed speaking
            sessions. This block currently uses available notes and feedback
            endpoints.
          </p>
        </div>

        <Badge variant="info">{notes.length + feedbackItems.length}</Badge>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 p-6">
          <p className="text-base font-bold text-indigo-700">
            Loading previous session activity...
          </p>
        </div>
      ) : hasHistory ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xl font-black text-slate-950">
              Recent correction notes
            </h3>

            <div className="mt-4 space-y-3">
              {notes.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm font-bold leading-6 text-slate-700">
                    {note.note_text}
                  </p>

                  <p className="mt-2 text-xs font-bold text-slate-400">
                    Room: {formatShortRoomId(note.room_id)}
                  </p>
                </div>
              ))}

              {notes.length === 0 && (
                <p className="text-base font-semibold text-slate-500">
                  No correction notes yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xl font-black text-slate-950">
              Recent feedback
            </h3>

            <div className="mt-4 space-y-3">
              {feedbackItems.slice(0, 3).map((item, index) => (
                <div
                  key={`${item.feedback}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm font-bold leading-6 text-slate-700">
                    {item.feedback}
                  </p>
                </div>
              ))}

              {feedbackItems.length === 0 && (
                <p className="text-base font-semibold text-slate-500">
                  No feedback yet.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-base font-bold text-slate-600">
            No previous sessions yet.
          </p>

          <p className="mt-2 text-base leading-7 text-slate-500">
            Correction notes and feedback will appear here after your speaking
            sessions.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const [pendingInvitations, setPendingInvitations] = useState<
    RoomInvitation[]
  >([]);
  const [notes, setNotes] = useState<LiveCorrectionNote[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<SessionFeedback[]>([]);

  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [decliningRoomId, setDecliningRoomId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadPendingInvitations = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoadingInvitations(true);
    }

    try {
      const data = await getPendingInvitations();

      setPendingInvitations(data.invitations || []);
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (!silent) {
        setDashboardError(
          error instanceof Error
            ? error.message
            : "Failed to load pending invitations",
        );
      }
    } finally {
      if (!silent) {
        setIsLoadingInvitations(false);
      }
    }
  }, []);

  const loadActiveRoom = useCallback(async () => {
    try {
      const room = await getActiveRoom();

      if (room) {
        saveActiveRoomId(room.room_id);
        setActiveRoomId(room.room_id);
      } else {
        removeActiveRoomId();
        setActiveRoomId(null);
      }
    } catch {
      // Keep whatever was previously known; the backend may be briefly unavailable.
    }
  }, []);

  const loadPreviousActivity = useCallback(async () => {
    setIsLoadingHistory(true);

    try {
      const [loadedNotes, loadedFeedback] = await Promise.all([
        getLiveCorrectionNotes(),
        getSessionFeedback(),
      ]);

      setNotes(Array.isArray(loadedNotes) ? loadedNotes : []);
      setFeedbackItems(Array.isArray(loadedFeedback) ? loadedFeedback : []);
    } catch {
      setNotes([]);
      setFeedbackItems([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const initialLoadTimeoutId = window.setTimeout(() => {
      void loadActiveRoom();
      void loadPendingInvitations();
      void loadPreviousActivity();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadPendingInvitations(true);
    }, 3000);

    return () => {
      window.clearTimeout(initialLoadTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadActiveRoom, loadPendingInvitations, loadPreviousActivity, router]);

  async function handleFindMatch() {
    setDashboardError(null);
    setIsFindingMatch(true);

    try {
      const match = await createRoom();

      saveSessionPartnerUserId(match.room_id, match.invited_user_id);
      saveActiveRoomId(match.room_id);
      setActiveRoomId(match.room_id);

      router.push(`/session/${match.room_id}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to find a speaking partner";

      setDashboardError(message);

      if (isActiveRoomConflict(message)) {
        void loadActiveRoom();
      }
    } finally {
      setIsFindingMatch(false);
    }
  }

  async function handleJoinInvitation(invitation: RoomInvitation) {
    setDashboardError(null);
    setJoiningRoomId(invitation.room_id);

    try {
      await joinRoom(invitation.room_id);

      saveSessionPartnerUserId(
        invitation.room_id,
        invitation.creator_user_id,
      );

      saveActiveRoomId(invitation.room_id);
      setActiveRoomId(invitation.room_id);

      router.push(`/session/${invitation.room_id}`);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Failed to join room",
      );
    } finally {
      setJoiningRoomId(null);
    }
  }

  async function handleDeclineInvitation(invitation: RoomInvitation) {
    setDashboardError(null);
    setDecliningRoomId(invitation.room_id);

    try {
      await declineInvitation(invitation.room_id);

      setPendingInvitations((currentInvitations) =>
        currentInvitations.filter(
          (currentInvitation) =>
            currentInvitation.room_id !== invitation.room_id,
        ),
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Failed to decline invitation",
      );
    } finally {
      setDecliningRoomId(null);
    }
  }

  function handleContinueActiveRoom() {
    if (!activeRoomId) {
      return;
    }

    router.push(`/session/${activeRoomId}`);
  }

  function handleForgetActiveRoom() {
    removeActiveRoomId();
    setActiveRoomId(null);
  }

  return (
    <PageContainer>
      <div className="mb-7">
        <Badge variant="success">Sessions dashboard</Badge>

        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Your speaking sessions
        </h1>

        <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
          Find a suitable speaking partner, accept incoming invitations, and
          review your previous speaking practice.
        </p>
      </div>

      {dashboardError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-base font-bold text-red-700 ring-1 ring-red-100">
          {dashboardError}
        </div>
      )}

      {activeRoomId && (
        <section className="mb-7">
          <Card className="border-indigo-100 bg-indigo-50 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Badge variant="info">Active session</Badge>

                <h2 className="mt-4 text-2xl font-black text-slate-950">
                  Continue current room
                </h2>

                <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                  The backend reports that you are already in an active room.
                  Use this button if you opened Profile or another page and
                  want to return to the session.
                </p>

                <p className="mt-3 break-all font-mono text-sm font-black text-indigo-800">
                  {activeRoomId}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button type="button" onClick={handleContinueActiveRoom}>
                  Continue session
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleForgetActiveRoom}
                >
                  Hide
                </Button>
              </div>
            </div>
          </Card>
        </section>
      )}

      <section className="mb-7">
        <Card className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="info">Find match</Badge>

              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Start a new audio session
              </h2>

              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                When you click Find partner, the backend creates a room, selects
                a matched available user, stores the invitation in the database,
                and opens the waiting room.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleFindMatch}
              disabled={isFindingMatch}
            >
              {isFindingMatch ? "Creating room..." : "Find partner"}
            </Button>
          </div>
        </Card>
      </section>

      <section className="mb-7">
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge
                variant={pendingInvitations.length > 0 ? "warning" : "info"}
              >
                Incoming invitations
              </Badge>

              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Room invitations
              </h2>

              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                This list refreshes automatically every 3 seconds. If someone
                invites you to a room, the invitation will appear here.
              </p>

              {lastUpdatedAt && (
                <p className="mt-2 text-sm font-bold text-slate-400">
                  Last checked: {lastUpdatedAt.toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge variant="info">{pendingInvitations.length}</Badge>

              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadPendingInvitations()}
                disabled={isLoadingInvitations}
              >
                {isLoadingInvitations ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {isLoadingInvitations ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 p-6">
              <p className="text-base font-bold text-indigo-700">
                Loading incoming invitations...
              </p>
            </div>
          ) : pendingInvitations.length > 0 ? (
            <div className="max-h-[520px] space-y-4 overflow-y-auto pr-2">
              {pendingInvitations.map((invitation) => (
                <InvitationCard
                  key={invitation.room_id}
                  invitation={invitation}
                  isJoining={joiningRoomId === invitation.room_id}
                  isDeclining={decliningRoomId === invitation.room_id}
                  onJoin={handleJoinInvitation}
                  onDecline={handleDeclineInvitation}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-base font-bold text-slate-600">
                No incoming invitations right now.
              </p>

              <p className="mt-2 text-base leading-7 text-slate-500">
                Keep this dashboard open. Invitations will appear here
                automatically when another user finds you as a matched partner.
              </p>
            </div>
          )}
        </Card>
      </section>

      <PreviousSessionsPreview
        notes={notes}
        feedbackItems={feedbackItems}
        isLoading={isLoadingHistory}
      />
    </PageContainer>
  );
}