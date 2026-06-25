"use client";

import { useMemo, useState } from "react";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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
  accepted: 1,
  pending: 2,
  declined: 3,
  expired_sender_busy: 4,
  expired_receiver_busy: 4,
  expired_timeout: 4,
};

function getStatusLabel(status: InvitationStatus, type: InvitationType) {
  if (status === "pending") {
    return type === "incoming" ? "Needs response" : "Waiting";
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

function getActiveSessionInvitation(
  outgoingInvitations: SessionInvitation[],
  incomingInvitations: SessionInvitation[],
) {
  const firstAcceptedOutgoing = getFirstAcceptedInvitation(outgoingInvitations);

  if (firstAcceptedOutgoing) {
    return firstAcceptedOutgoing;
  }

  const firstAcceptedIncoming = getFirstAcceptedInvitation(incomingInvitations);

  if (firstAcceptedIncoming) {
    return firstAcceptedIncoming;
  }

  return undefined;
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

function PartnerProfilePreview({
  invitation,
  onClose,
}: {
  invitation: SessionInvitation;
  onClose: () => void;
}) {
  const partnerInterests =
    invitation.partnerInterests && invitation.partnerInterests.length > 0
      ? invitation.partnerInterests
      : ["No interests provided"];

  const partnerBio =
    invitation.partnerBio ||
    "This partner has not added a bio yet, but you can still start a guided speaking session.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="info">Partner profile</Badge>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {invitation.partnerName}
            </h2>

            <p className="mt-2 text-base leading-7 text-slate-600">
              Review this learner&apos;s languages, interests, and bio before
              deciding whether to practice together.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Native language
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {invitation.partnerNativeLanguage}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Target language
            </p>
            <p className="mt-1 text-xl font-black text-indigo-700">
              {invitation.partnerTargetLanguage}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
            Suggested session
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {invitation.templateTitle}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Interests
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {partnerInterests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Bio
          </p>

          <p className="mt-2 text-base leading-7 text-slate-600">
            {partnerBio}
          </p>
        </div>

        <Button className="mt-6 w-full" variant="secondary" onClick={onClose}>
          Close profile
        </Button>
      </div>
    </div>
  );
}

function InvitationCard({
  invitation,
  type,
  activeSessionInvitation,
  onViewProfile,
  onRemove,
}: {
  invitation: SessionInvitation;
  type: InvitationType;
  activeSessionInvitation?: SessionInvitation;
  onViewProfile: (invitation: SessionInvitation) => void;
  onRemove: (invitationId: string) => void;
}) {
  const effectiveStatus = getEffectiveInvitationStatus(
    invitation,
    type,
    activeSessionInvitation,
  );

  const isPending = effectiveStatus === "pending";
  const isAccepted = effectiveStatus === "accepted";
  const isActiveSession = activeSessionInvitation?.id === invitation.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-extrabold text-slate-950">
            {type === "incoming"
              ? `${invitation.partnerName} invited you`
              : `You invited ${invitation.partnerName}`}
          </p>

          <p className="mt-1 text-base font-semibold text-slate-700">
            {invitation.templateTitle}
          </p>

          <p className="mt-1 text-base leading-7 text-slate-500">
            Native {invitation.partnerNativeLanguage} speaker learning{" "}
            {invitation.partnerTargetLanguage}
          </p>
        </div>

        <Badge variant={statusBadgeVariants[effectiveStatus]}>
          {getStatusLabel(effectiveStatus, type)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onViewProfile(invitation)}
        >
          View profile
        </Button>

        {type === "incoming" && isPending && (
          <>
            <Button type="button" size="sm">
              Accept
            </Button>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onRemove(invitation.id)}
            >
              Decline
            </Button>
          </>
        )}

        {type === "outgoing" && isPending && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRemove(invitation.id)}
          >
            Cancel invite
          </Button>
        )}

        {isAccepted && (
          <Button type="button" size="sm" variant="secondary" disabled>
            {isActiveSession ? "Active session" : "Closed"}
          </Button>
        )}

        {!isPending && !isAccepted && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRemove(invitation.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [incomingInvitations, setIncomingInvitations] = useState(
    mockIncomingInvitations,
  );
  const [outgoingInvitations, setOutgoingInvitations] = useState(
    mockOutgoingInvitations,
  );
  const [selectedInvitation, setSelectedInvitation] =
    useState<SessionInvitation | null>(null);

  const activeSessionInvitation = useMemo(
    () =>
      getActiveSessionInvitation(outgoingInvitations, incomingInvitations),
    [outgoingInvitations, incomingInvitations],
  );

  const sortedIncomingInvitations = useMemo(
    () =>
      sortInvitations(
        incomingInvitations,
        "incoming",
        activeSessionInvitation,
      ),
    [incomingInvitations, activeSessionInvitation],
  );

  const sortedOutgoingInvitations = useMemo(
    () =>
      sortInvitations(
        outgoingInvitations,
        "outgoing",
        activeSessionInvitation,
      ),
    [outgoingInvitations, activeSessionInvitation],
  );

  function removeIncomingInvitation(invitationId: string) {
    setIncomingInvitations((currentInvitations) =>
      currentInvitations.filter((invitation) => invitation.id !== invitationId),
    );
  }

  function removeOutgoingInvitation(invitationId: string) {
    setOutgoingInvitations((currentInvitations) =>
      currentInvitations.filter((invitation) => invitation.id !== invitationId),
    );
  }

  return (
    <PageContainer>
      {selectedInvitation && (
        <PartnerProfilePreview
          invitation={selectedInvitation}
          onClose={() => setSelectedInvitation(null)}
        />
      )}

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="success">Sessions dashboard</Badge>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Your speaking sessions
          </h1>

          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
            Manage your active session and partner invitations in one place.
          </p>
        </div>

        <Button size="md">Find partner</Button>
      </div>

      <section>
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6">
          {activeSessionInvitation ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge variant="success">Active session ready</Badge>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                  Session with {activeSessionInvitation.partnerName}
                </h2>

                <p className="mt-2 text-lg font-bold text-indigo-700">
                  {activeSessionInvitation.templateTitle}
                </p>

                <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                  Your guided audio room is ready. Other pending invitations are
                  closed because only one active session is allowed at a time.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Room status
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-600">
                  Ready
                </p>
                <Button className="mt-4 w-full" size="md">
                  Join audio room
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Badge variant="info">No active session</Badge>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                Find a partner to start practicing
              </h2>

              <p className="mt-2 max-w-3xl text-lg leading-8 text-slate-600">
                Send invitations to suitable partners. When someone accepts,
                SpeakFlow will create one active guided audio session.
              </p>

              <Button className="mt-5" size="md">
                Find partner
              </Button>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Incoming invitations
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-600">
                Review partner requests and accept one suitable invitation.
              </p>
            </div>

            <Badge variant="info">{sortedIncomingInvitations.length}</Badge>
          </div>

          <div className="space-y-4">
            {sortedIncomingInvitations.length > 0 ? (
              sortedIncomingInvitations.map((invitation) => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  type="incoming"
                  activeSessionInvitation={activeSessionInvitation}
                  onViewProfile={setSelectedInvitation}
                  onRemove={removeIncomingInvitation}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-base font-semibold text-slate-500">
                No incoming invitations.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Outgoing invitations
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-600">
                Track invitations you sent to potential speaking partners.
              </p>
            </div>

            <Badge variant="info">{sortedOutgoingInvitations.length}</Badge>
          </div>

          <div className="space-y-4">
            {sortedOutgoingInvitations.length > 0 ? (
              sortedOutgoingInvitations.map((invitation) => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  type="outgoing"
                  activeSessionInvitation={activeSessionInvitation}
                  onViewProfile={setSelectedInvitation}
                  onRemove={removeOutgoingInvitation}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-base font-semibold text-slate-500">
                No outgoing invitations.
              </p>
            )}
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}