from pydantic import BaseModel


class VocabularyItem(BaseModel):
    word: str
    meaning: str


class TopicCard(BaseModel):
    id: str
    title: str
    questions: list[str]
    vocabulary: list[VocabularyItem]

class SessionTemplate(BaseModel):
    id: str
    title: str
    topic_cards: list[TopicCard]
