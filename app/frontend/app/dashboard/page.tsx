"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  mockIncomingInvitations,
  mockOutgoingInvitations,
} from "@/lib/mockData";
import type { InvitationStatus, SessionInvitation } from "@/lib/types";
import { getCurrentUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";

type InvitationType = "incoming" | "outgoing";

type CorrectionNote = {
  id: string;
  phrase: string;
  correction: string;
  context: string;
};

type SessionHistoryItem = {
  id: string;
  partnerName: string;
  templateTitle: string;
  date: string;
  notesCount: number;
};

const statusBadgeVariants: Record<
  InvitationStatus,
  "success" | "info" | "warning"
> = {
  pending: "info",
  accepted: "success",
  declined: "warning",
  expired_sender_busy: "warning",
  expired_receiver_busy: "warning",
  expired_timeout: "warning",
};

const statusPriority: Record<InvitationStatus, number> = {
  accepted: 1,
  pending: 2,
  declined: 3,
  expired_sender_busy: 4,
  expired_receiver_busy: 4,
  expired_timeout: 4,
};

const correctionNotes: CorrectionNote[] = [
  {
    id: "note-1",
    phrase: "I am agree with you",
    correction: "I agree with you",
    context: "Agreement phrase during the discussion",
  },
  {
    id: "note-2",
    phrase: "I have 20 years",
    correction: "I am 20 years old",
    context: "Self-introduction practice",
  },
  {
    id: "note-3",
    phrase: "make a decision more fast",
    correction: "make a decision faster",
    context: "Project discussion",
  },
];

const sessionHistory: SessionHistoryItem[] = [
  {
    id: "history-1",
    partnerName: "Emma",
    templateTitle: "Small Talk",
    date: "Yesterday",
    notesCount: 4,
  },
  {
    id: "history-2",
    partnerName: "Marco",
    templateTitle: "IT Project Discussion",
    date: "2 days ago",
    notesCount: 7,
  },
];

function getStatusLabel(status: InvitationStatus, type: InvitationType) {
  if (status === "pending") {
    return type === "incoming" ? "Needs your response" : "Waiting";
  }

  if (status === "accepted") {
    return "Ready";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "expired_timeout") {
    return "Expired";
  }

  if (status === "expired_sender_busy") {
    return type === "outgoing" ? "You are matched" : "Partner unavailable";
  }

  if (status === "expired_receiver_busy") {
    return type === "outgoing" ? "Partner unavailable" : "You are matched";
  }

  return "Unknown";
}

function getFirstAcceptedInvitation(invitations: SessionInvitation[]) {
  return [...invitations]
    .filter((invitation) => invitation.status === "accepted")
    .sort((a, b) => {
      const aTime = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
      const bTime = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;

      return aTime - bTime;
    })[0];
}

function getActiveSessionInvitation() {
  const firstAcceptedOutgoing = getFirstAcceptedInvitation(
    mockOutgoingInvitations,
  );

  if (firstAcceptedOutgoing) {
    return {
      invitation: firstAcceptedOutgoing,
      type: "outgoing" as const,
      reason: "First accepted outgoing invitation",
    };
  }

  const firstAcceptedIncoming = getFirstAcceptedInvitation(
    mockIncomingInvitations,
  );

  if (firstAcceptedIncoming) {
    return {
      invitation: firstAcceptedIncoming,
      type: "incoming" as const,
      reason: "Accepted incoming invitation",
    };
  }

  return null;
}

function getEffectiveInvitationStatus(
  invitation: SessionInvitation,
  type: InvitationType,
  activeSessionInvitation?: SessionInvitation,
): InvitationStatus {
  if (!activeSessionInvitation) {
    return invitation.status;
  }

  if (invitation.id === activeSessionInvitation.id) {
    return "accepted";
  }

  if (invitation.status === "pending" || invitation.status === "accepted") {
    return type === "outgoing"
      ? "expired_sender_busy"
      : "expired_receiver_busy";
  }

  return invitation.status;
}

function sortInvitations(
  invitations: SessionInvitation[],
  type: InvitationType,
  activeSessionInvitation?: SessionInvitation,
) {
  return [...invitations].sort((a, b) => {
    const aStatus = getEffectiveInvitationStatus(
      a,
      type,
      activeSessionInvitation,
    );
    const bStatus = getEffectiveInvitationStatus(
      b,
      type,
      activeSessionInvitation,
    );

    return statusPriority[aStatus] - statusPriority[bStatus];
  });
}

function InvitationCard({
  invitation,
  type,
  activeSessionInvitation,
}: {
  invitation: SessionInvitation;
  type: InvitationType;
  activeSessionInvitation?: SessionInvitation;
}) {
  const effectiveStatus = getEffectiveInvitationStatus(
    invitation,
    type,
    activeSessionInvitation,
  );

  const isPending = effectiveStatus === "pending";
  const isAccepted = effectiveStatus === "accepted";
  const isExpired = effectiveStatus.startsWith("expired");
  const isActiveSession = activeSessionInvitation?.id === invitation.id;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xl font-extrabold text-slate-950">
            {type === "incoming"
              ? `${invitation.partnerName} invited you`
              : `You invited ${invitation.partnerName}`}
          </p>

          <p className="mt-2 text-lg font-semibold text-slate-700">
            {invitation.templateTitle}
          </p>

          <p className="mt-2 text-base leading-8 text-slate-500">
            Native {invitation.partnerNativeLanguage} speaker learning{" "}
            {invitation.partnerTargetLanguage}
          </p>
        </div>

        <Badge variant={statusBadgeVariants[effectiveStatus]}>
          {getStatusLabel(effectiveStatus, type)}
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {type === "incoming" && isPending && (
          <>
            <Button size="md">Accept</Button>
            <Button size="md" variant="secondary">
              Decline
            </Button>
          </>
        )}

        {type === "outgoing" && isPending && (
          <Button size="md" variant="secondary" disabled>
            Waiting for partner
          </Button>
        )}

        {isAccepted && (
          <Button size="md" variant="secondary" disabled>
            {isActiveSession ? "Shown as active session" : "Closed"}
          </Button>
        )}

        {isExpired && (
          <Button size="md" variant="ghost">
            Find another partner
          </Button>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    async function checkDashboardAccess() {
      const token = getAccessToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const user = await getCurrentUser();

        if (!isProfileComplete(user)) {
          router.replace("/profile/setup");
          return;
        }

        setIsCheckingAccess(false);
      } catch {
        clearTokens();
        router.replace("/login");
      }
    }

    checkDashboardAccess();
  }, [router]);

  const activeSession = getActiveSessionInvitation();
  const activeSessionInvitation = activeSession?.invitation;

  const sortedIncomingInvitations = sortInvitations(
    mockIncomingInvitations,
    "incoming",
    activeSessionInvitation,
  );

  const sortedOutgoingInvitations = sortInvitations(
    mockOutgoingInvitations,
    "outgoing",
    activeSessionInvitation,
  );

  if (isCheckingAccess) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-2xl">
          <Card>
            <p className="text-center text-lg font-semibold text-slate-600">
              Checking your profile...
            </p>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="success">Sessions dashboard</Badge>

          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Your speaking sessions
          </h1>

          <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
            Manage active sessions, partner invitations, and correction notes in
            one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/profile"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-bold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
          >
            View profile
          </Link>

          <Button size="lg">Find partner</Button>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-8">
          {activeSession ? (
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge variant="success">Active session ready</Badge>

                <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                  Session with {activeSession.invitation.partnerName}
                </h2>

                <p className="mt-3 text-xl font-bold text-indigo-700">
                  {activeSession.invitation.templateTitle}
                </p>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                  The session is ready because of the rule:{" "}
                  <span className="font-bold text-slate-800">
                    {activeSession.reason}
                  </span>
                  . Other pending or accepted invitations are closed because only
                  one active session is allowed at a time.
                </p>
              </div>

              <div className="shrink-0 rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Room status
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  Ready
                </p>
                <Button className="mt-5 w-full" size="lg">
                  Join audio room
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Badge variant="info">No active session</Badge>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                Find a partner to start practicing
              </h2>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Send invitations to several suitable partners. When someone
                accepts, SpeakFlow will create one active guided audio session.
              </p>

              <Button className="mt-6" size="lg">
                Find partner
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-950">
                Live correction notes
              </h2>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Helper notes will appear here during and after the session.
              </p>
            </div>

            <Badge variant="info">Mock</Badge>
          </div>

          <div className="mt-7 space-y-4">
            {correctionNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  Correction
                </p>
                <p className="mt-3 text-base text-slate-500 line-through">
                  {note.phrase}
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-950">
                  {note.correction}
                </p>
                <p className="mt-3 text-base leading-7 text-slate-500">
                  {note.context}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="p-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-950">
                Incoming invitations
              </h2>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Accept one invitation only when no outgoing invitation has
                already created a session.
              </p>
            </div>

            <Badge variant="info">{sortedIncomingInvitations.length}</Badge>
          </div>

          <div className="space-y-4">
            {sortedIncomingInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                type="incoming"
                activeSessionInvitation={activeSessionInvitation}
              />
            ))}
          </div>
        </Card>

        <Card className="p-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-950">
                Outgoing invitations
              </h2>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                If several partners accept, the first accepted invitation becomes
                the active session.
              </p>
            </div>

            <Badge variant="info">{sortedOutgoingInvitations.length}</Badge>
          </div>

          <div className="space-y-4">
            {sortedOutgoingInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                type="outgoing"
                activeSessionInvitation={activeSessionInvitation}
              />
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-950">
                Recent sessions
              </h2>
              <p className="mt-3 text-lg leading-8 text-slate-600">
                Review previous guided sessions and correction notes.
              </p>
            </div>

            <Button variant="secondary">View all</Button>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {sessionHistory.map((session) => (
              <div
                key={session.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-bold text-slate-400">
                  {session.date}
                </p>

                <h3 className="mt-3 text-2xl font-black text-slate-950">
                  {session.templateTitle}
                </h3>

                <p className="mt-3 text-lg text-slate-600">
                  Partner: {session.partnerName}
                </p>

                <p className="mt-4 text-base font-bold text-indigo-700">
                  {session.notesCount} correction notes
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}