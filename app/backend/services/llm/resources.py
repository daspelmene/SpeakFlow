from pathlib import Path
import json

BASE_DIR = Path(__file__).resolve().parents[2]

TEMPLATE_FILE = BASE_DIR / "resources" / "session_template.json"

with open(TEMPLATE_FILE, encoding="utf-8") as f:
    TEMPLATE_SCHEMA = json.dumps(
        json.load(f),
        indent=2,
        ensure_ascii=False,
    )