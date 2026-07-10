#!/usr/bin/env bash
# Build the Sphinx HTML documentation.
# Source: sphinx/   Output: docs/ (git-ignored, local preview only — the
# live site is built and deployed by .github/workflows/docs.yml, not this
# script; run this locally just to preview before pushing)
#
# Usage:
#   bash sphinx/scripts/build_docs.sh           # build only
#   bash sphinx/scripts/build_docs.sh --open    # build + open in default browser
#   bash sphinx/scripts/build_docs.sh -W        # treat warnings as errors
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPEN=0
SPHINX_ARGS=()

for arg in "$@"; do
    case "$arg" in
        --open|-o) OPEN=1 ;;
        *)         SPHINX_ARGS+=("$arg") ;;
    esac
done

# Stage README.md, references/ and examples/ into the Sphinx source dir so
# myst-parser resolves relative includes/links correctly during the build.
cp "$ROOT/README.md" "$ROOT/sphinx/config/README.md"
rm -rf "$ROOT/sphinx/config/references" "$ROOT/sphinx/config/examples"
cp -r "$ROOT/references" "$ROOT/sphinx/config/references"
cp -r "$ROOT/examples" "$ROOT/sphinx/config/examples"

sphinx-build -b html "$ROOT/sphinx/config" "$ROOT/docs" "${SPHINX_ARGS[@]+"${SPHINX_ARGS[@]}"}"

# Clean up staged files — they are build-time only, not source-controlled
# inside sphinx/config/ (the real sources live at repo root).
rm -f "$ROOT/sphinx/config/README.md"
rm -rf "$ROOT/sphinx/config/references" "$ROOT/sphinx/config/examples"

# Required for GitHub Pages to serve Sphinx's _static/ directory correctly.
touch "$ROOT/docs/.nojekyll"

echo ""
echo "Docs ready: docs/index.html"

if [[ $OPEN -eq 1 ]]; then
    case "$(uname -s)" in
        Darwin) open "$ROOT/docs/index.html" ;;
        MINGW*|MSYS*|CYGWIN*) start "$ROOT/docs/index.html" ;;
        *) xdg-open "$ROOT/docs/index.html" ;;
    esac
fi
