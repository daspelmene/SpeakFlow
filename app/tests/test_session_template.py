import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_get_templates(client: AsyncClient):
    """GET /session-templates returns the template object."""
    resp = await client.get("/session-templates")
    assert resp.status_code == 200
    data = resp.json()
    # The endpoint returns the whole template object (not a dict of ids)
    assert "id" in data
    assert "title" in data
    assert "topic_cards" in data
