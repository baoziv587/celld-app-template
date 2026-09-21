#!/usr/bin/env bash

# Offline consistency check for the deployment layer. Needs no cluster.

set -Eeuo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$DEPLOY_DIR/.." && pwd)"
readonly DEPLOY_DIR REPO_ROOT

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# shellcheck source=deployments/versions.env
source "$DEPLOY_DIR/versions.env"
[[ "${CELLD_IMAGE:-}" =~ ^[a-z0-9./_-]+:[A-Za-z0-9._-]+$ ]] \
  || die "versions.env: CELLD_IMAGE must be a tagged image"

# Compose and the cluster must run the same celld.
grep -Fq "newTag: ${CELLD_IMAGE##*:}" "$DEPLOY_DIR/k8s/fleet/kustomization.yaml" \
  || die "k8s/fleet/kustomization.yaml does not pin ${CELLD_IMAGE##*:} (see versions.env)"

for config in "$REPO_ROOT"/apps/*/wrangler.json; do
  worker="$(basename "$(dirname "$config")")"
  overlay="$DEPLOY_DIR/k8s/workers/$worker"

  [[ "$(node -p "require('$config').name")" == "$worker" ]] \
    || die "apps/$worker/wrangler.json: \"name\" must equal the directory name"
  grep -Fq "apps/$worker/compose.yaml" "$REPO_ROOT/docker-compose.yaml" \
    || die "apps/$worker/compose.yaml is not included in docker-compose.yaml"
  grep -Fq "workers/$worker" "$DEPLOY_DIR/k8s/kustomization.yaml" \
    || die "workers/$worker is not listed in deployments/k8s/kustomization.yaml"

  if command -v kubectl >/dev/null 2>&1; then
    rendered="$(kubectl kustomize "$overlay")"
    # The release script publishes to <BUCKET_ROOT>/<worker>; the fleet must read the same prefix.
    grep -Eq "CELLD_BUCKET: [a-z0-9]+://[^/]+/$worker\$" <<<"$rendered" \
      || die "workers/$worker: CELLD_BUCKET must end in /$worker"
    grep -Fq "image: $CELLD_IMAGE" <<<"$rendered" \
      || die "workers/$worker does not run $CELLD_IMAGE"
  fi
  printf 'ok worker %s\n' "$worker"
done

if command -v docker >/dev/null 2>&1; then
  images="$(docker compose --project-directory "$REPO_ROOT" --profile all config --images)"
  services="$(docker compose --project-directory "$REPO_ROOT" --profile all config --services)"
  expected="$(grep -Ec -- '-celld$' <<<"$services" || true)"
  actual="$(grep -Fxc "$CELLD_IMAGE" <<<"$images" || true)"
  [[ "$expected" == "$actual" ]] \
    || die "Compose runs $actual celld node(s) on $CELLD_IMAGE, expected $expected"
  printf 'ok compose: %s celld node(s)\n' "$actual"
fi

printf 'infra consistent: %s\n' "$CELLD_IMAGE"
