"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getAccessToken } from "@/lib/auth";
import {
  getLiveCorrectionNotes,
  getSessionFeedback,
  type LiveCorrectionNote,
  type SessionFeedback,
} from "@/lib/sessionActivityApi";

type SessionHistoryGroup = {
  roomId: string;
  notes: LiveCorrectionNote[];
  feedbackItems: SessionFeedback[];
  latestActivityAt: number;
  earliestActivityAt: number;
};

function getTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatSessionDate(timestamp: number) {
  if (!timestamp) {
    return "Date unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function getFeedbackRoleTitle(authorRole: string) {
  if (authorRole === "helper") {
    return "Helper feedback";
  }

  if (authorRole === "learner") {
    return "Learner feedback";
  }

  return "Partner feedback";
}

function getFeedbackRoleBadgeVariant(authorRole: string) {
  if (authorRole === "helper") {
    return "success" as const;
  }

  if (authorRole === "learner") {
    return "info" as const;
  }

  return "neutral" as const;
}


function createEmptyGroup(roomId: string): SessionHistoryGroup {
  return {
    roomId,
    notes: [],
    feedbackItems: [],
    latestActivityAt: 0,
    earliestActivityAt: 0,
  };
}

function updateGroupDates(group: SessionHistoryGroup, timestamp: number) {
  if (!timestamp) {
    return;
  }

  group.latestActivityAt = Math.max(group.latestActivityAt, timestamp);

  if (!group.earliestActivityAt) {
    group.earliestActivityAt = timestamp;
    return;
  }

  group.earliestActivityAt = Math.min(group.earliestActivityAt, timestamp);
}

function buildSessionHistory(
  notes: LiveCorrectionNote[],
  feedbackItems: SessionFeedback[],
) {
  const groupsByRoomId = new Map<string, SessionHistoryGroup>();
  const ungroupedFeedback: SessionFeedback[] = [];

  for (const note of notes) {
    const roomId = note.room_id;

    if (!groupsByRoomId.has(roomId)) {
      groupsByRoomId.set(roomId, createEmptyGroup(roomId));
    }

    const group = groupsByRoomId.get(roomId);

    if (!group) {
      continue;
    }

    group.notes.push(note);
    updateGroupDates(group, getTimestamp(note.created_at));
  }

  for (const item of feedbackItems) {
    if (!item.room_id) {
      ungroupedFeedback.push(item);
      continue;
    }

    if (!groupsByRoomId.has(item.room_id)) {
      groupsByRoomId.set(item.room_id, createEmptyGroup(item.room_id));
    }

    const group = groupsByRoomId.get(item.room_id);

    if (!group) {
      continue;
    }

    group.feedbackItems.push(item);
    updateGroupDates(group, getTimestamp(item.created_at));
  }

  const groups = Array.from(groupsByRoomId.values()).sort(
    (left, right) => right.latestActivityAt - left.latestActivityAt,
  );

  return {
    groups,
    ungroupedFeedback,
  };
}

function SessionHistoryCard({
  group,
  index,
}: {
  group: SessionHistoryGroup;
  index: number;
}) {
  const sessionDate = formatSessionDate(
    group.earliestActivityAt || group.latestActivityAt,
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="info">Session {index + 1}</Badge>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Speaking practice session
            </h2>

            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
              Saved correction notes and feedback from this practice session.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{group.notes.length} notes</Badge>

            <Badge variant="success">
              {group.feedbackItems.length} feedback
            </Badge>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Session date
          </p>

          <p className="mt-1 text-xl font-black text-slate-950">
            {sessionDate}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-2">
        <section>
          <h3 className="text-2xl font-black text-slate-950">
            Correction notes
          </h3>

          <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">
            {group.notes.length > 0 ? (
              group.notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
                >
                  <p className="text-base font-bold leading-7 text-slate-800">
                    {note.note_text}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-base font-bold text-slate-500">
                No correction notes for this session.
              </p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-black text-slate-950">Feedback</h3>

          <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">
            {group.feedbackItems.length > 0 ? (
              group.feedbackItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
                >
                  <Badge variant={getFeedbackRoleBadgeVariant(item.author_role)}>
                    {getFeedbackRoleTitle(item.author_role)}
                  </Badge>

                  <p className="mt-2 text-base font-bold leading-7 text-slate-800">
                    {item.feedback}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-base font-bold text-slate-500">
                No feedback for this session.
              </p>
            )}
          </div>
        </section>
      </div>
    </Card>
  );
}

export default function HistoryPage() {
  const router = useRouter();

  const [notes, setNotes] = useState<LiveCorrectionNote[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<SessionFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setHistoryError(null);

    try {
      const [receivedNotes, receivedFeedback] = await Promise.all([
        getLiveCorrectionNotes("received"),
        getSessionFeedback("received"),
      ]);

      setNotes(Array.isArray(receivedNotes) ? receivedNotes : []);
      setFeedbackItems(Array.isArray(receivedFeedback) ? receivedFeedback : []);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Failed to load session history",
      );
      setNotes([]);
      setFeedbackItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadHistory, router]);

  const { groups, ungroupedFeedback } = useMemo(
    () => buildSessionHistory(notes, feedbackItems),
    [notes, feedbackItems],
  );

  const hasHistory = groups.length > 0 || ungroupedFeedback.length > 0;

  return (
    <PageContainer>
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="success">Previous sessions</Badge>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Practice history
          </h1>

          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
            Review your saved correction notes and feedback. Sessions are
            grouped visually, so the history stays easy to scan.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/dashboard")}
          >
            Back to dashboard
          </Button>

          <Button type="button" onClick={() => void loadHistory()}>
            Refresh
          </Button>
        </div>
      </div>

      {historyError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-base font-bold text-red-700 ring-1 ring-red-100">
          {historyError}
        </div>
      )}

      {isLoading ? (
        <Card className="p-6">
          <Badge variant="info">Loading</Badge>

          <h2 className="mt-4 text-2xl font-black text-slate-950">
            Loading session history...
          </h2>

          <p className="mt-2 text-base leading-7 text-slate-600">
            We are collecting your correction notes and feedback.
          </p>
        </Card>
      ) : hasHistory ? (
        <div className="max-h-[calc(100vh-260px)] space-y-6 overflow-y-auto pr-2">
          {groups.map((group, index) => (
            <SessionHistoryCard
              key={group.roomId}
              group={group}
              index={index}
            />
          ))}

          {ungroupedFeedback.length > 0 && (
            <Card className="border-amber-100 bg-amber-50 p-6">
              <Badge variant="warning">Ungrouped feedback</Badge>

              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Feedback without session metadata
              </h2>

              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                These feedback items do not include room_id yet, so they cannot
                be attached to a specific session card.
              </p>

              <div className="mt-5 max-h-[320px] space-y-3 overflow-y-auto pr-2">
                {ungroupedFeedback.map((item, index) => (
                  <div
                    key={`${item.feedback}-${index}`}
                    className="rounded-2xl border border-amber-100 bg-white p-4"
                  >
                    <p className="text-base font-bold leading-7 text-slate-800">
                      {item.feedback}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-6">
          <Badge variant="neutral">Empty history</Badge>

          <h2 className="mt-4 text-2xl font-black text-slate-950">
            No previous sessions yet
          </h2>

          <p className="mt-2 text-base leading-7 text-slate-600">
            After your speaking sessions, saved correction notes and feedback
            will appear here.
          </p>
        </Card>
      )}
    </PageContainer>
  );
}