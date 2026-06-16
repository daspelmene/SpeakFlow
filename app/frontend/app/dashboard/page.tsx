import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/layout/PageContainer";
import {
  mockIncomingInvitations,
  mockOutgoingInvitations,
} from "@/lib/mockData";
import type { InvitationStatus, SessionInvitation } from "@/lib/types";

type InvitationType = "incoming" | "outgoing";

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
  pending: 1,
  accepted: 2,
  declined: 3,
  expired_sender_busy: 4,
  expired_receiver_busy: 4,
  expired_timeout: 4,
};

function getStatusLabel(status: InvitationStatus, type: InvitationType) {
  if (status === "pending") {
    return "Waiting for response";
  }

  if (status === "accepted") {
    return "Session ready";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "expired_timeout") {
    return "Expired: no response";
  }

  if (status === "expired_sender_busy") {
    return type === "outgoing"
      ? "Expired: you are already matched"
      : "Expired: partner is no longer available";
  }

  if (status === "expired_receiver_busy") {
    return type === "outgoing"
      ? "Expired: partner is no longer available"
      : "Expired: you are already matched";
  }

  return "Unknown status";
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
      reason: "This partner was the first to accept your outgoing invitation.",
    };
  }

  const firstAcceptedIncoming = getFirstAcceptedInvitation(
    mockIncomingInvitations,
  );

  if (firstAcceptedIncoming) {
    return {
      invitation: firstAcceptedIncoming,
      type: "incoming" as const,
      reason:
        "No outgoing invitation was accepted, so the session uses the incoming invitation you accepted.",
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {type === "incoming"
              ? `${invitation.partnerName} invited you`
              : `You invited ${invitation.partnerName}`}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Template: {invitation.templateTitle}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Native {invitation.partnerNativeLanguage} speaker, learning{" "}
            {invitation.partnerTargetLanguage}
          </p>

        </div>

        <Badge variant={statusBadgeVariants[effectiveStatus]}>
          {getStatusLabel(effectiveStatus, type)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {type === "incoming" && isPending && (
          <>
            <Button>Accept</Button>
            <Button variant="secondary">Decline</Button>
          </>
        )}

        {type === "outgoing" && isPending && (
          <Button variant="secondary" disabled>
            Waiting for partner
          </Button>
        )}

        {isAccepted && (
          <Button variant="secondary" disabled>
            {isActiveSession ? "Session shown above" : "Expired by active session"}
          </Button>
        )}

        {isExpired && <Button variant="secondary">Find another partner</Button>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
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

  return (
    <PageContainer>
      <div className="mb-8">
        <Badge variant="success">Ready for practice</Badge>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Welcome back
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          SpeakFlow helps you quickly find a match: if one of your outgoing
          invitations is accepted, the first accepted one creates the session.
          Otherwise, the session can be created from an incoming invitation you
          accepted.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-indigo-600">Step 1</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Complete profile
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Your profile is used for partner matching: native language, target
            language, level, country, and interests.
          </p>
          <div className="mt-4">
            <Button variant="secondary">View profile</Button>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-indigo-600">Step 2</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Find partner
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Send several invitations to increase the chance of quickly finding a
            match.
          </p>
          <div className="mt-4">
            <Button>Find partner</Button>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-indigo-600">Step 3</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Join guided audio room
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            After a match is confirmed, SpeakFlow creates a guided audio room with
            roles, timers, topic cards, and correction notes.
          </p>
        </Card>
      </section>

      {activeSession && (
        <section className="mt-8">
          <Card className="border-emerald-200 bg-emerald-50">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge variant="success">Active session</Badge>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  Session with {activeSession.invitation.partnerName} is ready
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Template: {activeSession.invitation.templateTitle}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {activeSession.reason}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Other pending or accepted invitations are expired because only
                  one active session is allowed at a time.
                </p>
              </div>

              <Button>Join guided session</Button>
            </div>
          </Card>
        </section>
      )}

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Incoming invitations
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            If no outgoing invitation is accepted, you can create a session by
            accepting one incoming invitation.
          </p>

          <div className="mt-4 space-y-4">
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

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Outgoing invitations
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            If several people accept your invitations, the first accepted
            invitation creates the session.
          </p>

          <div className="mt-4 space-y-4">
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
    </PageContainer>
  );
}