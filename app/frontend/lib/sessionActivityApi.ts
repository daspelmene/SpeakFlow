import { getAuthHeaders, request } from "@/lib/api";

export type LiveCorrectionNote = {
  id: number;
  room_id: string;
  author_id: number;
  target_user_id: number;
  note_text: string;
  created_at: string;
};

export type CreateLiveCorrectionNotePayload = {
  room_id: string;
  target_user_id: number;
  note_text: string;
};

export type SessionActivityScope = "received" | "authored";

export type SessionFeedbackAuthorRole = "helper" | "learner";

export type SessionFeedback = {
  id: number;
  room_id: string;
  author_id: number;
  target_user_id: number;
  author_role: SessionFeedbackAuthorRole;
  feedback: string;
  created_at: string;
};

export type CreateSessionFeedbackPayload = {
  room_id: string;
  target_user_id: number;
  author_role: SessionFeedbackAuthorRole;
  feedback: string;
};

function getScopeQuery(scope: SessionActivityScope) {
  return `?scope=${encodeURIComponent(scope)}`;
}

export function getLiveCorrectionNotes(
  scope: SessionActivityScope = "received",
) {
  return request<LiveCorrectionNote[]>(`/api/v1/notes${getScopeQuery(scope)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
}

export function getAuthoredLiveCorrectionNotes() {
  return getLiveCorrectionNotes("authored");
}

export function createLiveCorrectionNote(
  payload: CreateLiveCorrectionNotePayload,
) {
  return request<LiveCorrectionNote>("/api/v1/notes/create", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
}

export function getSessionFeedback(
  scope: SessionActivityScope = "received",
) {
  return request<SessionFeedback[]>(
    `/api/v1/feedback${getScopeQuery(scope)}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    },
  );
}

export function getAuthoredSessionFeedback() {
  return getSessionFeedback("authored");
}

export function createSessionFeedback(payload: CreateSessionFeedbackPayload) {
  return request<SessionFeedback>("/api/v1/feedback/create", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
}