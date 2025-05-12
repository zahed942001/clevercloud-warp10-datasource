# scripts/filter_grafana_versions.py

import json
import sys

# Read JSON from stdin
raw_input = sys.stdin.read()

try:
    versions = json.loads(raw_input)
except json.JSONDecodeError as e:
    print(f"Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

filtered = [entry for entry in versions if entry.get("name") != "grafana-dev"]
print(json.dumps(filtered))
