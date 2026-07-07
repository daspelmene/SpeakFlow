"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import AudioRoom from "@/components/AudioRoom";
import VocabularyHints from "@/components/VocabularyHints";
import PageContainer from "@/components/layout/PageContainer";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/api";
import type { Participant, RoomStatus } from "@/hooks/useAudioRoom";
import { getActiveRoom } from "@/lib/roomApi";
import {
  createLiveCorrectionNote,
  createSessionFeedback,
  getAuthoredLiveCorrectionNotes,
  getAuthoredSessionFeedback,
  type LiveCorrectionNote,
  type SessionFeedback,
} from "@/lib/sessionActivityApi";
import { getSessionPartnerUserId } from "@/lib/sessionPartnerStorage";
import {
  getSessionContentUnlocked,
  getSessionUiSnapshot,
  saveSessionContentUnlocked,
  saveSessionUiSnapshot,
} from "@/lib/sessionUiSnapshotStorage";
import {
  generateSessionTemplates,
  getSessionTemplates,
  type SessionTemplate,
} from "@/lib/sessionTemplateApi";

type SessionRole = "helper" | "learner" | "unknown";

type AudioRoomStateSnapshot = {
  status: RoomStatus;
  roomId: string | null;
  userSlot: string | null;
  role?: string | null;
  participants: Participant[];
};

function getServerRole(role: string | null | undefined) {
  if (role === "helper" || role === "learner") {
    return role;
  }

  return null;
}

function getRoleFromUserSlot(userSlot: string | null): SessionRole {
  if (!userSlot) {
    return "unknown";
  }

  return userSlot === "user1" ? "helper" : "learner";
}

function getRoleTitle(role: SessionRole) {
  if (role === "helper") {
    return "Helper";
  }

  if (role === "learner") {
    return "Learner";
  }

  return "Role is not assigned yet";
}

function getRoleDescription(role: SessionRole) {
  if (role === "helper") {
    return "You guide the conversation, ask questions, and write correction notes for your partner.";
  }

  if (role === "learner") {
    return "You answer questions, practice speaking, and use vocabulary hints when needed.";
  }

  return "Your role will appear after you connect to the audio room.";
}

function getStatusLabel(status: RoomStatus) {
  if (status === "idle") {
    return "Not connected";
  }

  if (status === "creating") {
    return "Creating";
  }

  if (status === "connecting") {
    return "Connecting";
  }

  if (status === "waiting") {
    return "Waiting";
  }

  if (status === "active") {
    return "Active";
  }

  return "Finished";
}

function getFeedbackAuthorRole(role: SessionRole) {
  if (role === "helper" || role === "learner") {
    return role;
  }

  return null;
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

export default function SessionRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const [audioStatus, setAudioStatus] = useState<RoomStatus>("idle");
  const [currentUserSlot, setCurrentUserSlot] = useState<string | null>(null);
  const [serverRole, setServerRole] = useState<"helper" | "learner" | null>(
    null,
  );
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [noteText, setNoteText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [notes, setNotes] = useState<LiveCorrectionNote[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<SessionFeedback[]>([]);

  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [partnerUserIdFromStorage, setPartnerUserIdFromStorage] = useState<
    number | null
  >(null);

  const [sessionTemplate, setSessionTemplate] =
    useState<SessionTemplate | null>(null);

  const [wasSessionContentUnlocked, setWasSessionContentUnlocked] =
    useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setWasSessionContentUnlocked(getSessionContentUnlocked(roomId));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPartnerUserIdFromStorage(getSessionPartnerUserId(roomId));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      const savedTemplate = getSessionUiSnapshot(roomId);

      if (savedTemplate && isMounted) {
        setSessionTemplate(savedTemplate);
        return;
      }

      async function loadTemplate() {
        try {
          const templates = await getSessionTemplates();
          const firstTemplate = Object.values(templates)[0] ?? null;

          if (isMounted) {
            setSessionTemplate(firstTemplate);

            if (firstTemplate) {
              saveSessionUiSnapshot(roomId, firstTemplate);
            }
          }
        } catch {
          if (isMounted) {
            setSessionTemplate(null);
          }
        }
      }

      void loadTemplate();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      async function restoreActiveRoomState() {
        try {
          const activeRoom = await getActiveRoom();

          if (!isMounted || !activeRoom) {
            return;
          }

          if (activeRoom.room_id === roomId) {
            setCurrentUserSlot(activeRoom.user_slot);
            setServerRole(getServerRole(activeRoom.role));

            saveSessionContentUnlocked(roomId);
            setWasSessionContentUnlocked(true);
          }
        } catch {
          // If active-room is unavailable, WebSocket room-state can still update the page.
        }
      }

      void restoreActiveRoomState();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      async function loadCurrentSessionActivity() {
        try {
          const [loadedNotes, loadedFeedback] = await Promise.all([
            getAuthoredLiveCorrectionNotes(),
            getAuthoredSessionFeedback(),
          ]);

          if (!isMounted) {
            return;
          }

          const roomNotes = Array.isArray(loadedNotes)
            ? loadedNotes.filter((note) => note.room_id === roomId)
            : [];

          const roomFeedback = Array.isArray(loadedFeedback)
            ? loadedFeedback.filter((item) => item.room_id === roomId)
            : [];

          setNotes(roomNotes);
          setFeedbackItems(roomFeedback);
        } catch {
          if (!isMounted) {
            return;
          }

          setNotes([]);
          setFeedbackItems([]);
        }
      }

      void loadCurrentSessionActivity();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  const topicCards = useMemo(
    () => sessionTemplate?.topic_cards ?? [],
    [sessionTemplate],
  );

  const vocabularyHints = useMemo(
    () => topicCards.flatMap((card) => card.vocabulary),
    [topicCards],
  );

  const targetUserId = useMemo(() => {
    const partner = participants.find(
      (participant) => participant.slot !== currentUserSlot,
    );

    return partner?.userId ?? partnerUserIdFromStorage;
  }, [participants, currentUserSlot, partnerUserIdFromStorage]);

  const currentRole = useMemo(
    () => serverRole ?? getRoleFromUserSlot(currentUserSlot),
    [serverRole, currentUserSlot],
  );

  useEffect(() => {
    if (!currentUserSlot || targetUserId === null) {
      return;
    }

    const sessionUserSlot = currentUserSlot;
    const partnerUserId = targetUserId;

    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      async function generateAiTemplate() {
        try {
          const currentUser = await getCurrentUser();

          const user1Id =
            sessionUserSlot === "user1" ? currentUser.id : partnerUserId;

          const user2Id =
            sessionUserSlot === "user1" ? partnerUserId : currentUser.id;

          const generatedTemplates = await generateSessionTemplates({
            user1_id: user1Id,
            user2_id: user2Id,
          });

          const templateForCurrentUser =
            sessionUserSlot === "user1"
              ? generatedTemplates.user1_template
              : generatedTemplates.user2_template;

          if (!isMounted) {
            return;
          }

          setSessionTemplate(templateForCurrentUser);
          saveSessionUiSnapshot(roomId, templateForCurrentUser);
        } catch {
          // If DeepSeek is not configured or generation fails, keep static fallback.
        }
      }

      void generateAiTemplate();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [currentUserSlot, roomId, targetUserId]);
  
  const isSessionReady = participants.length >= 2;
  const isSessionActive = audioStatus === "active";
  const isSessionEnded = audioStatus === "ended";

  const shouldShowSessionContent =
    isSessionReady ||
    wasSessionContentUnlocked ||
    isSessionActive ||
    isSessionEnded;

  useEffect(() => {
    if (!isSessionReady && !isSessionActive && !isSessionEnded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveSessionContentUnlocked(roomId);
      setWasSessionContentUnlocked(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSessionActive, isSessionEnded, isSessionReady, roomId]);

  const handleRoomStateChange = useCallback((state: AudioRoomStateSnapshot) => {
    setAudioStatus(state.status);

    if (state.userSlot) {
      setCurrentUserSlot(state.userSlot);
    }

    if (state.role === "helper" || state.role === "learner") {
      setServerRole(state.role);
    }

    setParticipants(state.participants);
  }, []);

  async function handleSaveNote(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = noteText.trim();

    if (!text || !targetUserId) {
      return;
    }

    setIsSavingNote(true);
    setSessionError(null);

    try {
      const createdNote = await createLiveCorrectionNote({
        room_id: roomId,
        target_user_id: targetUserId,
        note_text: text,
      });

      setNotes((currentNotes) => [createdNote, ...currentNotes]);
      setNoteText("");
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Failed to save correction note",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleSaveFeedback(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = feedbackText.trim();
    const feedbackAuthorRole = getFeedbackAuthorRole(currentRole);

    if (!text || !targetUserId || !feedbackAuthorRole) {
      return;
    }

    setIsSavingFeedback(true);
    setSessionError(null);

    try {
      const createdFeedback = await createSessionFeedback({
        room_id: roomId,
        target_user_id: targetUserId,
        author_role: feedbackAuthorRole,
        feedback: text,
      });

      setFeedbackItems((currentItems) => [createdFeedback, ...currentItems]);
      setFeedbackText("");
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Failed to save feedback",
      );
    } finally {
      setIsSavingFeedback(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-7">
        <Badge variant="success">Guided speaking room</Badge>

        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Audio speaking session
        </h1>

        <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
          Connect to the room, wait for your partner, and start structured
          speaking practice when both participants are online.
        </p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Room status
          </p>

          <p className="mt-2 text-2xl font-black text-slate-950">
            {getStatusLabel(audioStatus)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Your role
          </p>

          <p className="mt-2 text-2xl font-black text-indigo-700">
            {getRoleTitle(currentRole)}
          </p>
        </Card>
      </div>

      {sessionError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-base font-bold text-red-700 ring-1 ring-red-100">
          {sessionError}
        </div>
      )}

      {!targetUserId && shouldShowSessionContent && (
        <div className="mb-6 rounded-2xl bg-amber-50 px-5 py-4 text-base font-bold text-amber-800 ring-1 ring-amber-100">
          Partner user id is not available yet. Notes and feedback can be saved
          only after the partner mapping is available from the dashboard flow or
          from WebSocket participants.
        </div>
      )}

      {!shouldShowSessionContent && (
        <Card className="mb-6 p-6">
          <Badge variant="info">Waiting room</Badge>

          <h2 className="mt-4 text-2xl font-black text-slate-950">
            Waiting for your partner
          </h2>

          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Session content is hidden until the invited user joins the room.
            Keep this page open. When the second participant connects, guided
            speaking content and notes will appear.
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-6">
          {shouldShowSessionContent ? (
            <>
              <Card className="p-6">
                <Badge variant="info">Session topic</Badge>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                  {sessionTemplate?.title ?? "Loading session topic..."}
                </h2>

                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                  Use the topic cards below to keep the speaking session
                  structured.
                </p>
              </Card>

              {topicCards.map((card) => (
                <Card key={card.id} className="p-6">
                  <Badge variant="info">Topic card</Badge>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                    {card.title}
                  </h2>

                  <div className="mt-5 space-y-3">
                    {card.questions.map((question, index) => (
                      <div
                        key={question}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm font-black uppercase tracking-wide text-indigo-500">
                          Question {index + 1}
                        </p>

                        <p className="mt-1 text-base font-bold leading-7 text-slate-900">
                          {question}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              <VocabularyHints hints={vocabularyHints} />
            </>
          ) : (
            <Card className="p-6">
              <Badge variant="warning">Locked content</Badge>

              <h2 className="mt-4 text-2xl font-black text-slate-950">
                Session content is hidden
              </h2>

              <p className="mt-3 text-base leading-7 text-slate-600">
                Topic cards, useful words, correction notes, and feedback will
                become available when both participants are connected.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <Badge variant="success">Role guide</Badge>

            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
              {getRoleTitle(currentRole)}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {getRoleDescription(currentRole)}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold leading-6 text-slate-500">
                Role switching is intentionally disabled for now. It should be
                synchronized by the backend through a WebSocket event to prevent
                both users from becoming helpers or learners at the same time.
              </p>
            </div>
          </Card>

          <AudioRoom
            initialRoomId={roomId}
            showRoomCode={false}
            onRoomStateChange={handleRoomStateChange}
          />

          {shouldShowSessionContent && currentRole === "helper" && (
            <Card className="p-5">
              <Badge variant="warning">Live notes</Badge>

              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
                Correction notes
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Save short correction notes for your partner. After rejoining
                this session, your own saved notes will remain visible here.
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleSaveNote}>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder='Example: Say "I agree", not "I am agree".'
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={!targetUserId || !noteText.trim() || isSavingNote}
                >
                  {isSavingNote ? "Saving..." : "Save note"}
                </Button>
              </form>

              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-2">
                {notes.length > 0 ? (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-bold leading-6 text-slate-800">
                        {note.note_text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
                    No notes yet.
                  </p>
                )}
              </div>
            </Card>
          )}

          {shouldShowSessionContent && currentRole === "learner" && (
            <Card className="p-5">
              <Badge variant="info">Correction notes</Badge>

              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
                Your helper writes notes
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                During this phase, your partner acts as the helper and can save
                correction notes about your speaking practice.
              </p>
            </Card>
          )}

          {shouldShowSessionContent && (
            <Card className="p-5">
              <Badge variant="neutral">Feedback</Badge>

              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
                Feedback you wrote
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Save feedback you wrote for your partner. After rejoining this
                session, your own saved feedback will remain visible here.
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleSaveFeedback}>
                <textarea
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  placeholder="Example: Good speaking pace, but try to answer in full sentences."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !targetUserId ||
                    !feedbackText.trim() ||
                    isSavingFeedback ||
                    !getFeedbackAuthorRole(currentRole)
                  }
                >
                  {isSavingFeedback ? "Saving..." : "Save feedback"}
                </Button>
              </form>

              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-2">
                {feedbackItems.length > 0 ? (
                  feedbackItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <Badge
                        variant={getFeedbackRoleBadgeVariant(item.author_role)}
                      >
                        {getFeedbackRoleTitle(item.author_role)}
                      </Badge>

                      <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
                        {item.feedback}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
                    No feedback yet.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}