import asyncio
import json

from .deepseek_service import generate_json
from .prompts import build_learner_centered_session_template_prompt


async def generate_learner_centered_template(learner, helper):
    messages = build_learner_centered_session_template_prompt(
        learner=learner,
        helper=helper,
    )

    content = await generate_json(messages)
    return json.loads(content)


async def generate_both_templates(user1, user2, common_interests_text=None):
    """Generate templates by learner slot.

    user1_template means: template for the case when user1 is the learner.
    user2_template means: template for the case when user2 is the learner.
    """

    user1_as_learner_template, user2_as_learner_template = await asyncio.gather(
        generate_learner_centered_template(learner=user1, helper=user2),
        generate_learner_centered_template(learner=user2, helper=user1),
    )

    return user1_as_learner_template, user2_as_learner_template