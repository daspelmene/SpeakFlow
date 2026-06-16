import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/session-templates", tags=["session-templates"])


TEMPLATES_FILE = (
    Path(__file__).resolve().parents[2]
    / "resources"
    / "session_templates.json"
)


@router.get("")
def get_templates():
    with open(TEMPLATES_FILE) as f:
        return json.load(f)


@router.get("/{template_id}")
def get_template(template_id: str):
    with open(TEMPLATES_FILE) as f:
        templates = json.load(f)
    
    template = templates.get(template_id)

    if template is None:
        raise HTTPException(
            status_code=404,
            detail="Template not found",
        )
    
    return template
