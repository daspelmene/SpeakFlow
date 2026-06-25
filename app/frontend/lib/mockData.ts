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
    partnerInterests: ["Education", "Travel", "Culture"],
    partnerBio:
      "I study international relations and want to practice Russian through structured conversations about student life, culture, and travel.",
    templateTitle: "University Life Discussion",
    status: "pending",
  },
  {
    id: "incoming-2",
    partnerName: "Marco",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    partnerInterests: ["IT", "Startups", "Business"],
    partnerBio:
      "I work on small IT projects and want to improve my Russian for professional communication. I enjoy discussing startups and product ideas.",
    templateTitle: "IT Project Discussion",
    status: "accepted",
    acceptedAt: "2026-06-15T08:15:00Z",
  },
  {
    id: "incoming-3",
    partnerName: "Emma",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    partnerInterests: ["Movies", "Music", "Reading"],
    partnerBio:
      "I am learning Russian for everyday communication. I like relaxed conversations about movies, books, music, and daily life.",
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
    partnerInterests: ["Career", "Interviews", "Technology"],
    partnerBio:
      "I want to practice Russian in professional situations and can help with English interview preparation and workplace vocabulary.",
    templateTitle: "Job Interview Practice",
    status: "accepted",
    acceptedAt: "2026-06-15T08:10:00Z",
  },
  {
    id: "outgoing-2",
    partnerName: "Sofia",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    partnerInterests: ["Travel", "Languages", "Culture"],
    partnerBio:
      "I enjoy learning languages through travel stories and cultural exchange. I would like to practice Russian for real-life travel conversations.",
    templateTitle: "Travel Conversation",
    status: "accepted",
    acceptedAt: "2026-06-15T08:12:00Z",
  },
  {
    id: "outgoing-3",
    partnerName: "Daniel",
    partnerNativeLanguage: "English",
    partnerTargetLanguage: "Russian",
    partnerInterests: ["Gaming", "Sports", "Movies"],
    partnerBio:
      "I prefer casual speaking practice and want to discuss hobbies, games, movies, and everyday topics while improving my Russian.",
    templateTitle: "Small Talk",
    status: "pending",
  },
];