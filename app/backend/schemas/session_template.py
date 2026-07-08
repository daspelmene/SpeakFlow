from pydantic import BaseModel


class VocabularyItem(BaseModel):
    word: str
    meaning: str


class TopicCard(BaseModel):
    subtitle: str
    questions: list[str]
    vocabulary: list[VocabularyItem]


class SessionTemplate(BaseModel):
    title: str
    topic_card: TopicCard


class SessionTemplateGenerateRequest(BaseModel):
    user1_id: int
    user2_id: int

class SessionTemplatesResponse(BaseModel):
    user1_template: SessionTemplate
    user2_template: SessionTemplate
