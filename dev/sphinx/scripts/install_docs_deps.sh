#!/usr/bin/env bash
# Install the docs dependencies into the active venv.
# Run with your project venv already activated.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
pip install -e "$ROOT[docs]"
echo "Done. Run  bash dev/sphinx/scripts/build_docs.sh  to build."
