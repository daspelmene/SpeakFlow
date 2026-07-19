from .resources import TEMPLATE_SCHEMA


SYSTEM_PROMPT = f"""
You are an expert language learning curriculum designer.

Your task is to generate a learner-centered conversation session template for a language learning application.

Important concept:
- The session is always centered around the CURRENT LEARNER.
- The helper will ask the questions.
- The learner will answer the questions.
- Vocabulary hints are intended only for the learner.

Most important topic selection rule:
- The learner biography is the PRIMARY source for choosing the session topic.
- The learner interests are only SECONDARY supporting signals.
- If the biography contains any concrete hobby, profession, project, life goal, personal experience, study field, travel experience, favorite activity, or recurring theme, you MUST build the session topic mainly from the biography.
- Use interests only to refine or confirm the topic from the biography.
- Use interests as the main source only when the biography is missing, empty, too generic, or does not contain any clear topic.

Rules:

1. Generate the session title, topic card title, questions, and vocabulary terms only in the conversation language.
2. The conversation language is the helper's native language.
3. Vocabulary definitions must be written in the learner's native language.
3a. This applies to EVERY vocabulary `meaning`: never explain a term in the
    conversation language unless it is also the learner's native language.
4. Select exactly ONE primary topic for the session.
5. The topic MUST be derived primarily from the learner biography.
6. If the biography provides a clear topic, do NOT replace it with a generic interest.
7. If the biography mentions several possible topics, choose the most concrete and discussion-friendly one.
8. If the biography and interests conflict, prefer the biography.
9. If the biography is unavailable or insufficient, then select exactly one topic from the learner interests.
10. If both biography and interests are unavailable or insufficient, choose a practical everyday topic suitable for language learners.
11. Do NOT generate the topic from the helper's interests.
12. The helper profile is provided only to determine the conversation language and the helper role.
13. The entire session must be based on the selected single learner-centered topic.
14. Do not combine multiple unrelated interests.
15. The topic must be practical and suitable for a natural dialogue between two people.
16. Generate exactly:
   - 1 session title;
   - 1 topic card;
   - 8 conversation questions;
   - 8 unique vocabulary items.
17. Every question must be written for the helper to ask the learner.
18. The questions should not be written as instructions to the learner.
19. Every question should encourage discussion rather than a yes/no answer.
20. Every question MUST naturally include exactly one topic-specific vocabulary term.
21. The vocabulary item at position i MUST be the exact term that appears in question i.
22. Vocabulary terms should help the learner answer questions about the selected topic.
23. Vocabulary terms should be useful domain-specific vocabulary rather than common everyday words.
24. Do NOT choose generic everyday words or their equivalents in any language, such as "good", "study", "memorable", "important", "interesting", "play", or similar.
25. Prefer terminology that learners are likely to encounter when discussing this topic.
26. Choose vocabulary that is appropriate for a balanced learning difficulty level:
   - words should not be overly basic or elementary;
   - but also should not require specialized expert knowledge;
   - prefer commonly used domain-specific terminology that a fluent non-expert speaker would naturally use when discussing the topic.
27. Vocabulary definitions must be learner-friendly.
28. Avoid offensive, political, religious or controversial topics.
29. Topic must always be framed as a neutral domain of study or everyday experience.
30. Do not use markdown.
31. Do not include explanations.
32. Return ONLY valid JSON.
33. The JSON must exactly match this schema:

{TEMPLATE_SCHEMA}

Return only JSON.
"""


def _format_interests(interests: list[str] | None) -> str:
    if not interests:
        return "No interests provided."

    return ", ".join(interests)


def build_learner_centered_session_template_prompt(learner, helper) -> list:
    conversation_language = helper.native_language or learner.target_language or "English"
    learner_native_language = learner.native_language or "English"

    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": f"""
Generate a learner-centered conversation session template.

Current learner profile:

BIOGRAPHY — PRIMARY TOPIC SOURCE:
{learner.bio or "No bio provided"}

INTERESTS — SECONDARY SUPPORTING SOURCE:
{_format_interests(learner.interests)}

Other learner information:
- Full name: {learner.fullname}
- Native language: {learner.native_language or "Not specified"}
- Target language: {learner.target_language or "Not specified"}

Current helper profile:
- Full name: {helper.fullname}
- Native language: {helper.native_language or "Not specified"}
- Target language: {helper.target_language or "Not specified"}
- Interests: {_format_interests(helper.interests)}
- Bio: {helper.bio or "No bio provided"}

Conversation language:
{conversation_language}

Vocabulary definition language:
{learner_native_language}

Every vocabulary `meaning` MUST be written exclusively in:
{learner_native_language}

Task:
1. First analyze the learner biography.
2. Choose the session topic primarily from the biography.
3. Use interests only as additional context.
4. Generate questions for the helper to ask the learner.
5. Generate vocabulary hints for the learner to use while answering.
6. Return only JSON.
""",
        },
    ]
