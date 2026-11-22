#!/usr/bin/env bash
#
# Build and push the Docker image for the web app to a container registry.
#
# Three tags are published for every build:
#   latest             moving tag for the newest build
#   <version>          the `version` field from package.json
#   sha-<commit>       the short git commit the image was built from
#
# Usage:
#   ./build.sh
#
# Configuration via environment variables:
#   REGISTRY   Registry/namespace prefix (default: "ghcr.io/r-tg").
#   IMAGE      Image name (default: telegram-tt-<branch>, where <branch> is
#              the current git branch with "/" and other unsafe characters
#              replaced by "-").
#   VERSION    Version tag (default: `version` from package.json).
#   PLATFORM   Target platform(s) for buildx, e.g. "linux/amd64" or
#              "linux/amd64,linux/arm64". Empty = native platform.
#   PUSH       "false" to build without pushing (default: "true").
#
# Examples:
#   ./build.sh                                   # build and push all three tags
#   PLATFORM=linux/amd64,linux/arm64 ./build.sh  # multi-arch build
#   PUSH=false ./build.sh                        # local build only

set -euo pipefail

cd "$(dirname "$0")"

# The image name carries the branch, so each branch publishes its own package.
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
BRANCH_SLUG="$(printf '%s' "${BRANCH:-nogit}" | tr '[:upper:]' '[:lower:]' | sed -e 's#[^a-z0-9._-]#-#g' -e 's#^[._-]*##' -e 's#[._-]*$##')"

IMAGE="${IMAGE:-telegram-tt-${BRANCH_SLUG:-nogit}}"
REGISTRY="${REGISTRY:-ghcr.io/r-tg}"
PUSH="${PUSH:-true}"
PLATFORM="${PLATFORM:-}"

# Resolve the git revision; fall back gracefully outside a git checkout.
HEAD="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"
VERSION="${VERSION:-$(node -p 'require("./package.json").version')}"

if [ -n "$REGISTRY" ]; then
  REPO="${REGISTRY%/}/${IMAGE}"
else
  REPO="${IMAGE}"
fi

TAG_ARGS=(-t "${REPO}:latest" -t "${REPO}:${VERSION}")
[ -n "$HEAD" ] && TAG_ARGS+=(-t "${REPO}:sha-${HEAD}")

echo "==> Image:    ${REPO}"
echo "==> Branch:   ${BRANCH:-unknown}"
echo "==> Tags:     latest, ${VERSION}${HEAD:+, sha-${HEAD}}"
echo "==> Push:     ${PUSH}"
[ -n "$PLATFORM" ] && echo "==> Platform: ${PLATFORM}"

if [ -n "$PLATFORM" ]; then
  # Multi-platform builds require buildx, which pushes in the same step.
  BUILDX_ARGS=(--platform "$PLATFORM" "${TAG_ARGS[@]}" --build-arg "HEAD=${HEAD}")
  if [ "$PUSH" = "true" ]; then
    BUILDX_ARGS+=(--push)
  else
    BUILDX_ARGS+=(--load)
  fi
  docker buildx build "${BUILDX_ARGS[@]}" .
else
  docker build "${TAG_ARGS[@]}" --build-arg "HEAD=${HEAD}" .
  if [ "$PUSH" = "true" ]; then
    for ARG in "${TAG_ARGS[@]}"; do
      [ "$ARG" = "-t" ] && continue
      docker push "$ARG"
    done
  fi
fi

echo "==> Done."
