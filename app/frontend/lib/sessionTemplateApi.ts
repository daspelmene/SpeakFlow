import { request } from "@/lib/api";

export type VocabularyItem = {
  word: string;
  meaning: string;
};

export type TopicCard = {
  id: string;
  title: string;
  questions: string[];
  vocabulary: VocabularyItem[];
};

export type SessionTemplate = {
  title: string;
  topic_cards: TopicCard[];
};

export type SessionTemplatesById = Record<string, SessionTemplate>;

export function getSessionTemplates() {
  return request<SessionTemplatesById>("/api/v1/session-templates", {
    method: "GET",
  });
}

export function getSessionTemplate(templateId: string) {
  return request<SessionTemplate>(
    `/api/v1/session-templates/${encodeURIComponent(templateId)}`,
    {
      method: "GET",
    },
  );
}
