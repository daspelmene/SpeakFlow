import type { SessionInvitation, UserProfile } from "./types";

export const mockProfile: UserProfile = {
  name: "Damir",
  country: "Finland",
  nativeLanguage: "Russian",
  targetLanguage: "English",
  level: "Intermediate",
  interests: "IT, education, culture exchange",
  bio: "I want to improve my speaking skills through structured practice.",
};

export const mockIncomingInvitations: SessionInvitation[] = [
  {
    id: "incoming-1",
    partnerName: "Anna",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "University Life Discussion",
    status: "pending",
  },
  {
    id: "incoming-2",
    partnerName: "Marco",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "IT Project Discussion",
    status: "accepted",
    acceptedAt: "2026-06-15T08:15:00Z",
  },
  {
    id: "incoming-3",
    partnerName: "Emma",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "Small Talk",
    status: "expired_receiver_busy",
  },
];

export const mockOutgoingInvitations: SessionInvitation[] = [
  {
    id: "outgoing-1",
    partnerName: "John",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "Job Interview Practice",
    status: "accepted",
    acceptedAt: "2026-06-15T08:10:00Z",
  },
  {
    id: "outgoing-2",
    partnerName: "Sofia",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "Travel Conversation",
    status: "accepted",
    acceptedAt: "2026-06-15T08:12:00Z",
  },
  {
    id: "outgoing-3",
    partnerName: "Daniel",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    templateTitle: "Small Talk",
    status: "pending",
  },
];