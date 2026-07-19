import { getAuthHeaders, request } from "@/lib/api";

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

export type SessionTemplatesByLearnerSlot = {
  user1_template: SessionTemplate;
  user2_template: SessionTemplate;
};

type BackendVocabularyItem = {
  word: string;
  meaning: string;
};

type BackendTopicCard = {
  subtitle: string;
  questions: string[];
  vocabulary: BackendVocabularyItem[];
};

type BackendSessionTemplate = {
  title: string;
  topic_card: BackendTopicCard;
};

type GenerateSessionTemplatesPayload = {
  room_id?: string;
  user1_id: number;
  user2_id: number;
};

type GenerateSessionTemplatesResponse = {
  user1_template: BackendSessionTemplate;
  user2_template: BackendSessionTemplate;
};

function toFrontendTemplate(
  template: BackendSessionTemplate,
  idPrefix: string,
): SessionTemplate {
  return {
    title: template.title,
    topic_cards: [
      {
        id: `${idPrefix}-topic-card`,
        title: template.topic_card.subtitle,
        questions: template.topic_card.questions,
        vocabulary: template.topic_card.vocabulary,
      },
    ],
  };
}

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

export async function generateSessionTemplates(
  payload: GenerateSessionTemplatesPayload,
): Promise<SessionTemplatesByLearnerSlot> {
  const response = await request<GenerateSessionTemplatesResponse>(
    "/api/v1/session-templates/generate",
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );

  return {
    user1_template: toFrontendTemplate(response.user1_template, "user1"),
    user2_template: toFrontendTemplate(response.user2_template, "user2"),
  };
}