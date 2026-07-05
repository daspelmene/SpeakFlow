import json
import logging
import os
from typing import Any
from urllib import error, request

logger = logging.getLogger("llm")


class LLMGenerationError(RuntimeError):
    pass


def _fallback_summary(topic: str, notes: list[str], feedback: list[str]) -> str:
    if notes or feedback:
        bullet_points = []
        if notes:
            bullet_points.append("Key notes: " + "; ".join(notes[:3]))
        if feedback:
            bullet_points.append("Feedback: " + "; ".join(feedback[:3]))
        return f"Session summary for {topic}. " + " ".join(bullet_points)
    return f"The session for {topic} focused on meaningful conversation practice and collaborative feedback."


def _fallback_topics(topic_hint: str | None = None) -> list[dict[str, str]]:
    base = topic_hint or "speaking practice"
    return [
        {
            "title": f"Discuss {base}",
            "description": "Practice speaking naturally with a partner and exchange ideas.",
        },
        {
            "title": "Summarize your experience",
            "description": "Reflect on what went well and what felt challenging.",
        },
    ]


def generate_session_summary(
    topic: str,
    notes: list[str] | None = None,
    feedback: list[str] | None = None,
) -> str:
    notes = notes or []
    feedback = feedback or []
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_summary(topic, notes, feedback)

    prompt = (
        "You are a helpful speaking coach. Write a concise session summary in 2-4 sentences "
        f"for a speaking session on '{topic}'. Include these notes and feedback: "
        f"notes={notes}; feedback={feedback}"
    )

    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": "You write concise coaching summaries."}, {"role": "user", "content": prompt}],
        "temperature": 0.3,
    }

    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            choices = payload.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                content = message.get("content", "")
                if content:
                    return content.strip()
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("OpenAI summary generation failed, falling back: %s", exc)

    return _fallback_summary(topic, notes, feedback)


def generate_session_topics(topic_hint: str | None = None) -> list[dict[str, str]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_topics(topic_hint)

    prompt = (
        "Create 3 short speaking practice topic cards for a language exchange session. "
        "Return valid JSON with a list of objects containing title and description fields."
    )
    if topic_hint:
        prompt += f" The user mentioned: {topic_hint}."

    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": "You generate structured topic cards."}, {"role": "user", "content": prompt}],
        "temperature": 0.4,
    }

    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            choices = payload.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                content = message.get("content", "")
                if content:
                    parsed = json.loads(content)
                    if isinstance(parsed, list):
                        return [item for item in parsed if isinstance(item, dict)]
    except Exception as exc:
        logger.warning("OpenAI topic generation failed, falling back: %s", exc)

    return _fallback_topics(topic_hint)
