"""Write the OpenAPI spec to docs/api/openapi.json for the frontend team (P1).

Run from backend/:  uv run python scripts/export_openapi.py
CI fails if the committed file is out of date (see .github/workflows/ci.yml).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "docs" / "api" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    spec = create_app().openapi()
    OUT.write_text(
        json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"Wrote {OUT} ({len(spec['paths'])} paths)")


if __name__ == "__main__":
    main()
