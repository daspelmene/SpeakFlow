export type UserLevel = "Beginner" | "Intermediate" | "Advanced";

export interface UserProfile {
  name: string;
  country: string;
  nativeLanguage: string;
  targetLanguage: string;
  level: UserLevel;
  interests: string;
  bio: string;
}

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired_sender_busy"
  | "expired_receiver_busy"
  | "expired_timeout";

export interface SessionInvitation {
  id: string;
  partnerName: string;
  partnerNativeLanguage: string;
  partnerTargetLanguage: string;
  partnerInterests?: string[];
  partnerBio?: string;
  templateTitle: string;
  status: InvitationStatus;

  /**
   * Used to decide who accepted first.
   * In real backend this should be a timestamp from the database.
   */
  acceptedAt?: string;
}