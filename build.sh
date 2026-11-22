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
#   VERSION    Version tag. When unset, the `buildVersion` patch in
#              package.json is auto-incremented and that becomes the tag.
#   BUMP       "false" to skip auto-incrementing `buildVersion` and just use
#              its current value (default: "true"). Ignored when VERSION is set.
#   PLATFORM   Target platform(s) for buildx, e.g. "linux/amd64" or
#              "linux/amd64,linux/arm64". Empty = native platform.
#   PUSH       "false" to build without pushing (default: "true").
#   GIT_PUSH   "false" to commit the bumped `buildVersion` without pushing the
#              commit to the git remote (default: "true").
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
BUMP="${BUMP:-true}"
GIT_PUSH="${GIT_PUSH:-true}"

# Resolve the git revision; fall back gracefully outside a git checkout.
HEAD="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"

# Resolve the version tag. Without an explicit VERSION, bump the `buildVersion`
# patch in package.json (unless BUMP=false) and tag the image with the result.
DID_BUMP="false"
if [ -n "${VERSION:-}" ]; then
  :
elif [ "$BUMP" = "true" ]; then
  DID_BUMP="true"
  VERSION="$(node -e '
    const fs = require("fs");
    const path = "./package.json";
    const text = fs.readFileSync(path, "utf8");
    const match = text.match(/("buildVersion"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")/);
    if (!match) { console.error("buildVersion x.y.z not found in package.json"); process.exit(1); }
    const next = match[2] + "." + match[3] + "." + (Number(match[4]) + 1);
    fs.writeFileSync(path, text.replace(match[0], match[1] + next + match[5]));
    process.stdout.write(next);
  ')"
else
  VERSION="$(node -p 'require("./package.json").buildVersion')"
fi

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

# Commit the auto-incremented `buildVersion` now that the build has succeeded.
if [ "$DID_BUMP" = "true" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  if ! git diff --quiet -- package.json; then
    git commit -q -m "[Build] Bump buildVersion to ${VERSION}" -- package.json
    echo "==> Committed buildVersion ${VERSION}"
    if [ "$GIT_PUSH" = "true" ]; then
      git push -q && echo "==> Pushed buildVersion commit"
    fi
  fi
fi

echo "==> Done."
