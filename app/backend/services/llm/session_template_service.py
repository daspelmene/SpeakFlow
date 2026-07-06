import json
import asyncio
from .deepseek_service import generate_json
from .prompts import build_session_template_prompt

async def generate_user_template(user, common_interests_text):
    messages = build_session_template_prompt(
        user=user,
        common_interests=common_interests_text
    )

    content = await generate_json(messages)
    return json.loads(content)


async def generate_both_templates(user1, user2, common_interests_text):

    t1, t2 = await asyncio.gather(
        generate_user_template(user1, common_interests_text),
        generate_user_template(user2, common_interests_text),
    )

    return t1, t2