import json
from pathlib import Path
import asyncio
from fastapi import APIRouter, Depends, HTTPException

from schemas.session_template import (
    SessionTemplateGenerateRequest,
    SessionTemplatesResponse,
)
from services.llm.session_template_service import generate_both_templates
from storage.database import Database

router = APIRouter(prefix="/session-templates", tags=["session-templates"])

DEFAULT_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[2] / "resources" / "session_template.json"
)

_GENERATED_TEMPLATE_CACHE: dict[str, dict] = {}
_GENERATED_TEMPLATE_LOCKS: dict[str, asyncio.Lock] = {}


def _get_generation_cache_key(request: SessionTemplateGenerateRequest) -> str:
    if request.room_id is not None:
        return str(request.room_id)

    return f"{request.user1_id}:{request.user2_id}"


def _load_default_session_templates() -> dict:
    with DEFAULT_TEMPLATE_PATH.open("r", encoding="utf-8") as file:
        raw_template = json.load(file)

    topic_card = raw_template.get("topic_card", {})

    return {
        "default": {
            "title": raw_template.get("title", "Guided conversation"),
            "topic_cards": [
                {
                    "id": "default-topic-card",
                    "title": topic_card.get("subtitle", "Topic card"),
                    "questions": topic_card.get("questions", []),
                    "vocabulary": topic_card.get("vocabulary", []),
                }
            ],
        }
    }


@router.get("")
async def get_session_templates():
    return _load_default_session_templates()


@router.get("/{template_id}")
async def get_session_template(template_id: str):
    templates = _load_default_session_templates()

    template = templates.get(template_id)

    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/generate", response_model=SessionTemplatesResponse)
async def generate_template(
    request: SessionTemplateGenerateRequest,
    db: Database = Depends(Database.get_db),
):
    cache_key = _get_generation_cache_key(request)

    cached_template = _GENERATED_TEMPLATE_CACHE.get(cache_key)

    if cached_template is not None:
        return cached_template

    lock = _GENERATED_TEMPLATE_LOCKS.setdefault(cache_key, asyncio.Lock())

    async with lock:
        cached_template = _GENERATED_TEMPLATE_CACHE.get(cache_key)

        if cached_template is not None:
            return cached_template

        user1 = await db.users.get_user_by_id(request.user1_id)
        user2 = await db.users.get_user_by_id(request.user2_id)

        if user1 is None or user2 is None:
            raise HTTPException(
                status_code=404,
                detail="One or both users were not found.",
            )

        common_interests = list(set(user1.interests or []) & set(user2.interests or []))

        common_interests_text = (
            ", ".join(common_interests)
            if common_interests
            else "No common interests."
        )

        try:
            user1_template, user2_template = await generate_both_templates(
                user1,
                user2,
                common_interests_text,
            )
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="DeepSeek returned invalid JSON",
            ) from exc

        generated_template = {
            "user1_template": user1_template,
            "user2_template": user2_template,
        }

        _GENERATED_TEMPLATE_CACHE[cache_key] = generated_template

        return generated_template