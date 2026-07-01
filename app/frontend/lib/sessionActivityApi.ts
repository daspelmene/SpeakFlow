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

export type SessionFeedback = {
  feedback: string;
  id?: number;
  room_id?: string;
  author_id?: number;
  target_user_id?: number;
  created_at?: string;
};

export type CreateSessionFeedbackPayload = {
  room_id: string;
  target_user_id: number;
  feedback: string;
};

export function getLiveCorrectionNotes() {
  return request<LiveCorrectionNote[]>("/api/v1/notes", {
    method: "GET",
    headers: getAuthHeaders(),
  });
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

export function getSessionFeedback() {
  return request<SessionFeedback[]>("/api/v1/feedback", {
    method: "GET",
    headers: getAuthHeaders(),
  });
}

export async function createSessionFeedback(
  payload: CreateSessionFeedbackPayload,
) {
  const response = await request<SessionFeedback>("/api/v1/feedback/create", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return {
    ...payload,
    ...response,
  };
}