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
import {
  createLiveCorrectionNote,
  createSessionFeedback,
  type LiveCorrectionNote,
  type SessionFeedback,
} from "@/lib/sessionActivityApi";
import { getSessionPartnerUserId } from "@/lib/sessionPartnerStorage";
import type { Participant, RoomStatus } from "@/hooks/useAudioRoom";

type AudioRoomStateSnapshot = {
  status: RoomStatus;
  roomId: string | null;
  userSlot: string | null;
  participants: Participant[];
};

type SessionRole = "helper" | "learner" | "unknown";

const sessionTopic = {
  title: "Getting to know each other",
  description:
    "Practice introductions, personal interests, travel plans, and everyday conversation.",
};

const topicQuestions = [
  "Introduce yourself and tell your partner why you are learning this language.",
  "Describe a place you would like to travel to and explain why.",
  "Talk about your hobbies and ask your partner follow-up questions.",
  "Describe a recent challenge and how you solved it.",
];

const usefulWords = [
  {
    word: "conversation",
    meaning: "A talk between two or more people.",
  },
  {
    word: "fluency",
    meaning: "The ability to speak smoothly and naturally.",
  },
  {
    word: "confidence",
    meaning: "The feeling that you can do something well.",
  },
  {
    word: "improve",
    meaning: "To become better at something.",
  },
  {
    word: "Could you repeat that, please?",
    meaning: "A polite phrase to ask your partner to say something again.",
  },
  {
    word: "In my opinion...",
    meaning: "A phrase for starting your answer or sharing your point of view.",
  },
  {
    word: "What do you think about...?",
    meaning:
      "A phrase for asking your partner for an opinion and continuing the conversation.",
  },
  {
    word: "For example...",
    meaning: "A phrase for adding details or explaining your idea more clearly.",
  },
  {
    word: "I agree with you because...",
    meaning: "A phrase for responding to your partner and giving a reason.",
  },
  {
    word: "That reminds me of...",
    meaning:
      "A phrase for connecting your partner's idea with your own experience.",
  },
];

function getRole(userSlot: string | null): SessionRole {
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

export default function SessionRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const [audioStatus, setAudioStatus] = useState<RoomStatus>("idle");
  const [currentUserSlot, setCurrentUserSlot] = useState<string | null>(null);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPartnerUserIdFromStorage(getSessionPartnerUserId(roomId));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomId]);

  const targetUserId = useMemo(() => {
    const partner = participants.find(
      (participant) => participant.slot !== currentUserSlot,
    );

    return partner?.userId ?? partnerUserIdFromStorage;
  }, [participants, currentUserSlot, partnerUserIdFromStorage]);

  const currentRole = useMemo(
    () => getRole(currentUserSlot),
    [currentUserSlot],
  );

  const isSessionActive = audioStatus === "active";
  const isSessionEnded = audioStatus === "ended";
  const shouldShowSessionContent = isSessionActive || isSessionEnded;

  const handleRoomStateChange = useCallback((state: AudioRoomStateSnapshot) => {
    setAudioStatus(state.status);
    setCurrentUserSlot(state.userSlot);
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
        error instanceof Error ? error.message : "Failed to save correction note",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleSaveFeedback(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = feedbackText.trim();

    if (!text || !targetUserId) {
      return;
    }

    setIsSavingFeedback(true);
    setSessionError(null);

    try {
      const createdFeedback = await createSessionFeedback({
        room_id: roomId,
        target_user_id: targetUserId,
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

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Room ID
          </p>

          <p className="mt-2 break-all font-mono text-xl font-black text-slate-950">
            {roomId}
          </p>
        </Card>

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
                  {sessionTopic.title}
                </h2>

                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                  {sessionTopic.description}
                </p>
              </Card>

              <Card className="p-6">
                <Badge variant="info">Topic card</Badge>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                  Guided speaking questions
                </h2>

                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                  Use these questions to keep the speaking session structured.
                </p>

                <div className="mt-5 space-y-3">
                  {topicQuestions.map((question, index) => (
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

              <VocabularyHints hints={usefulWords} />
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
                Save short correction notes for your partner during the session.
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
                Partner feedback
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Current backend requires the room to exist when saving feedback,
                so save it before leaving the room.
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
                    !targetUserId || !feedbackText.trim() || isSavingFeedback
                  }
                >
                  {isSavingFeedback ? "Saving..." : "Save feedback"}
                </Button>
              </form>

              <div className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-2">
                {feedbackItems.length > 0 ? (
                  feedbackItems.map((item, index) => (
                    <div
                      key={`${item.feedback}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-bold leading-6 text-slate-800">
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