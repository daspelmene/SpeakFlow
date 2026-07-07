"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  createRoom,
  declineInvitation,
  getActiveRoom,
  getPendingInvitations,
  inviteByEmail,
  joinRoom,
  type RoomInvitation,
} from "@/lib/roomApi";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { getCurrentUser, isUnauthorizedError } from "@/lib/api";
import { removeActiveRoomId, saveActiveRoomId } from "@/lib/activeRoomStorage";
import { saveSessionPartnerUserId } from "@/lib/sessionPartnerStorage";
import {
  getLiveCorrectionNotes,
  getSessionFeedback,
  type LiveCorrectionNote,
  type SessionFeedback,
} from "@/lib/sessionActivityApi";

type InvitationProfile = {
  fullname?: string | null;
  native_language?: string | null;
  target_language?: string | null;
  interests?: string[] | string | null;
  bio?: string | null;
};

function isActiveRoomConflict(message: string) {
  return message.toLowerCase().includes("active room");
}

function getInvitationProfile(invitation: RoomInvitation) {
  return (
    invitation as RoomInvitation & {
      creator_profile?: InvitationProfile | null;
    }
  ).creator_profile;
}

function getProfileInterests(profile: InvitationProfile | null | undefined) {
  if (!profile?.interests) {
    return [];
  }

  if (Array.isArray(profile.interests)) {
    return profile.interests;
  }

  return [profile.interests];
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profile = getInvitationProfile(invitation);
  const interests = getProfileInterests(profile);

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

          {profile && (
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                {isProfileOpen ? "Hide profile" : "View profile"}
              </Button>
            </div>
          )}

          {isProfileOpen && profile && (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-amber-100">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Partner profile
              </p>

              <h4 className="mt-2 text-lg font-black text-slate-950">
                {profile.fullname || invitation.creator_user_name}
              </h4>

              <div className="mt-3 flex flex-wrap gap-2">
                {profile.native_language && (
                  <Badge variant="neutral">
                    Speaks {profile.native_language}
                  </Badge>
                )}

                {profile.target_language && (
                  <Badge variant="neutral">
                    Learning {profile.target_language}
                  </Badge>
                )}
              </div>

              {interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <Badge key={interest} variant="info">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}

              {profile.bio && (
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {profile.bio}
                </p>
              )}
            </div>
          )}
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
  onOpenHistory,
}: {
  notes: LiveCorrectionNote[];
  feedbackItems: SessionFeedback[];
  isLoading: boolean;
  onOpenHistory: () => void;
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
            Review saved correction notes and feedback from your previous
            speaking practice.
          </p>
        </div>
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

            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
              {notes.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm font-bold leading-6 text-slate-700">
                    {note.note_text}
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

            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
              {feedbackItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
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

      <div className="mt-5">
        <Button type="button" variant="secondary" onClick={onOpenHistory}>
          View full history
        </Button>
      </div>
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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [isInvitingByEmail, setIsInvitingByEmail] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [decliningRoomId, setDecliningRoomId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const handleUnauthorized = useCallback(() => {
    clearTokens();
    removeActiveRoomId();
    router.replace("/login");
  }, [router]);

  const loadPendingInvitations = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoadingInvitations(true);
    }

    try {
      const data = await getPendingInvitations();

      setPendingInvitations(data.invitations || []);
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }

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
  }, [handleUnauthorized]);

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
      } catch (error) {
        if (isUnauthorizedError(error)) {
          handleUnauthorized();
        }
      }
    }, [handleUnauthorized]);

    const loadPreviousActivity = useCallback(async () => {
      setIsLoadingHistory(true);

      try {
        const [receivedNotes, receivedFeedback] = await Promise.all([
          getLiveCorrectionNotes("received"),
          getSessionFeedback("received"),
        ]);

        setNotes(Array.isArray(receivedNotes) ? receivedNotes : []);
        setFeedbackItems(Array.isArray(receivedFeedback) ? receivedFeedback : []);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          handleUnauthorized();
          return;
        }

        setNotes([]);
        setFeedbackItems([]);
      } finally {
        setIsLoadingHistory(false);
      }
    }, [handleUnauthorized]);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    let isCancelled = false;

    const timeoutId = window.setTimeout(() => {
      async function loadDashboard() {
        try {
          await getCurrentUser();

          if (isCancelled) {
            return;
          }

          await Promise.all([
            loadActiveRoom(),
            loadPendingInvitations(),
            loadPreviousActivity(),
          ]);
        } catch (error) {
          if (isUnauthorizedError(error)) {
            handleUnauthorized();
            return;
          }

          setDashboardError(
            error instanceof Error
              ? error.message
              : "Failed to load dashboard",
          );
        }
      }

      void loadDashboard();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadPendingInvitations(true);
    }, 3000);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [
    handleUnauthorized,
    loadActiveRoom,
    loadPendingInvitations,
    loadPreviousActivity,
    router,
  ]);

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
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }

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

  async function handleInviteByEmail() {
    const email = inviteEmail.trim();

    if (!email) {
      return;
    }

    setDashboardError(null);
    setInviteError(null);
    setIsInvitingByEmail(true);

    try {
      const room = await inviteByEmail(email);

      saveSessionPartnerUserId(room.room_id, room.invited_user_id);
      saveActiveRoomId(room.room_id);
      setActiveRoomId(room.room_id);
      setInviteEmail("");

      router.push(`/session/${room.room_id}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to invite user";

      setInviteError(message);
      setDashboardError(message);

      if (isActiveRoomConflict(message)) {
        void loadActiveRoom();
      }
    } finally {
      setIsInvitingByEmail(false);
    }
  }

  async function handleJoinInvitation(invitation: RoomInvitation) {
    setDashboardError(null);
    setJoiningRoomId(invitation.room_id);

    try {
      await joinRoom(invitation.room_id);

      saveSessionPartnerUserId(invitation.room_id, invitation.creator_user_id);
      saveActiveRoomId(invitation.room_id);
      setActiveRoomId(invitation.room_id);

      router.push(`/session/${invitation.room_id}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }

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
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }

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
                  Continue current session
                </h2>

                <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                  The backend reports that you are already in an active room.
                  Use this button if you opened Profile or another page and
                  want to return to the session.
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

          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void handleInviteByEmail();
            }}
          >
            <div className="w-full sm:max-w-md">
              <Input
                type="email"
                placeholder="partner@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={isInvitingByEmail}
                error={inviteError ?? undefined}
                aria-label="Email of the user to invite"
              />
            </div>

            <Button
              type="submit"
              disabled={isInvitingByEmail || inviteEmail.trim().length === 0}
            >
              {isInvitingByEmail ? "Inviting..." : "Send invitation"}
            </Button>
          </form>
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
        onOpenHistory={() => router.push("/history")}
      />
    </PageContainer>
  );
}