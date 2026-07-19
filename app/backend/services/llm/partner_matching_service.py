import asyncio
import json
import logging

from models.user import User

from .deepseek_service import generate_json

logger = logging.getLogger(__name__)


def _profile(user: User) -> dict:
    return {
        "id": user.id,
        "native_language": user.native_language,
        "target_language": user.target_language,
        "interests": user.interests or [],
        "bio": user.bio or "",
    }


async def rank_matching_users(current_user: User, candidates: list[User]) -> list[User]:
    """Rank an already language-compatible candidate set with DeepSeek.

    Language compatibility remains a hard database constraint. If DeepSeek is
    unavailable or returns an invalid ranking, the stable database order is used.
    """
    if len(candidates) < 2:
        return candidates

    candidate_by_id = {candidate.id: candidate for candidate in candidates}
    messages = [
        {
            "role": "system",
            "content": (
                "Rank language-exchange partners by likely conversation compatibility. "
                "Use shared or complementary interests and concrete biography themes. "
                "Return only JSON shaped as {\"ranked_user_ids\": [integer, ...]}. "
                "Include every supplied candidate exactly once and invent no IDs."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "current_user": _profile(current_user),
                    "candidates": [_profile(candidate) for candidate in candidates],
                },
                ensure_ascii=False,
            ),
        },
    ]

    try:
        content = await asyncio.wait_for(
            generate_json(messages, temperature=0.1), timeout=10
        )
        result = json.loads(content)
        ranked_ids = result.get("ranked_user_ids")
        if (
            not isinstance(ranked_ids, list)
            or len(ranked_ids) != len(candidates)
            or set(ranked_ids) != set(candidate_by_id)
        ):
            raise ValueError("DeepSeek returned an incomplete partner ranking")
        return [candidate_by_id[user_id] for user_id in ranked_ids]
    except Exception as exc:
        logger.warning("DeepSeek partner ranking failed; using stable fallback: %s", exc)
        return candidates
