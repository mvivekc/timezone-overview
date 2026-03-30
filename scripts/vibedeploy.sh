#!/usr/bin/env bash
# vibedeploy — automated build + deploy for timezone-helper
# Usage: ./scripts/vibedeploy.sh [--project <name>]

set -euo pipefail

PROJECT="${PROJECT_NAME:-timezone-helper}"
POLL_INTERVAL=15
BUILD_TIMEOUT=900   # 15 min
DEPLOY_TIMEOUT=300  # 5 min

# ── helpers ────────────────────────────────────────────────────────────────────

green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
blue()   { printf '\033[0;34m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }
ts()     { date '+%H:%M:%S'; }

step() { echo; blue "▶ [$(ts)] $*"; }
info() { yellow "  [$(ts)] $*"; }
ok()   { green  "  [$(ts)] ✓ $*"; }
fail() { red    "  [$(ts)] ✗ $*"; }

# ── pre-flight ─────────────────────────────────────────────────────────────────

step "Pre-flight checks"

if ! command -v vibectl &>/dev/null; then
  fail "vibectl not found. Run: vibectl login"
  exit 1
fi

if ! command -v git &>/dev/null; then
  fail "git not found"
  exit 1
fi

# Discover project name from git config if not overridden
GIT_PROJECT=$(git config --get vibectl.project-name 2>/dev/null || true)
if [[ -n "$GIT_PROJECT" ]]; then
  PROJECT="$GIT_PROJECT"
fi
info "Project: $PROJECT"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "Uncommitted changes detected. Please commit first."
  git status --short
  exit 1
fi
ok "Working tree is clean"

# ── push ──────────────────────────────────────────────────────────────────────

step "Pushing latest commits to GitHub"
BRANCH=$(git branch --show-current)
info "Branch: $BRANCH"

git push origin "$BRANCH"
ok "Pushed to origin/$BRANCH"

COMMIT=$(git rev-parse HEAD)
SHORT_COMMIT=${COMMIT:0:7}
info "Commit: $SHORT_COMMIT"

# ── build ─────────────────────────────────────────────────────────────────────

step "Triggering build (commit $SHORT_COMMIT)"
vibectl build trigger --project "$PROJECT" --commit "$COMMIT"

info "Polling build status every ${POLL_INTERVAL}s (timeout ${BUILD_TIMEOUT}s)..."
elapsed=0
last_status=""
build_id=""

while true; do
  raw=$(vibectl build status --project "$PROJECT" 2>&1)

  # Extract status line (handles ✅ ⏳ 🔨 ❌)
  status_line=$(echo "$raw" | grep -iE 'status.*:' | head -1 || true)
  status=$(echo "$status_line" | awk -F': ' '{print $2}' | tr -d ' ' || true)

  # Extract build ID if not captured yet
  if [[ -z "$build_id" ]]; then
    build_id=$(echo "$raw" | grep -i '^ID' | awk '{print $NF}' | head -1 || true)
  fi

  if [[ "$status" != "$last_status" ]]; then
    case "$status" in
      *pending*)   info "Build status → pending (queued, waiting for builder)" ;;
      *building*)  info "Build status → building (installing deps & compiling)" ;;
      *succeeded*) ok   "Build status → succeeded" ;;
      *failed*)    fail "Build status → failed"; echo "$raw"; exit 1 ;;
      *)           info "Build status → $status" ;;
    esac
    last_status="$status"
  fi

  if echo "$status" | grep -qi 'succeeded'; then
    break
  fi

  if (( elapsed >= BUILD_TIMEOUT )); then
    fail "Build timed out after ${BUILD_TIMEOUT}s. Check manually:"
    echo "  vibectl build status --project $PROJECT"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
  (( elapsed += POLL_INTERVAL ))
done

# ── deploy ────────────────────────────────────────────────────────────────────

step "Triggering deployment (commit $SHORT_COMMIT)"
vibectl deploy trigger --project "$PROJECT" --commit "$COMMIT"

info "Polling deploy status every ${POLL_INTERVAL}s (timeout ${DEPLOY_TIMEOUT}s)..."
elapsed=0
last_status=""
preview_url=""

while true; do
  raw=$(vibectl deploy status --project "$PROJECT" 2>&1)

  status_line=$(echo "$raw" | grep -iE 'status.*:' | head -1 || true)
  status=$(echo "$status_line" | awk -F': ' '{print $2}' | tr -d ' ' || true)

  # Capture preview URL when it appears
  if [[ -z "$preview_url" ]]; then
    preview_url=$(echo "$raw" | grep -iE 'https?://' | grep -oE 'https?://[^ ]+' | head -1 || true)
  fi

  if [[ "$status" != "$last_status" ]]; then
    case "$status" in
      *deploying*) info "Deploy status → deploying (rolling out to Kubernetes)" ;;
      *succeeded*) ok   "Deploy status → succeeded" ;;
      *failed*)    fail "Deploy status → failed"; echo "$raw"; exit 1 ;;
      *)           info "Deploy status → $status" ;;
    esac
    last_status="$status"
  fi

  if echo "$status" | grep -qi 'succeeded'; then
    break
  fi

  if (( elapsed >= DEPLOY_TIMEOUT )); then
    fail "Deploy timed out after ${DEPLOY_TIMEOUT}s. Check manually:"
    echo "  vibectl deploy status --project $PROJECT"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
  (( elapsed += POLL_INTERVAL ))
done

# ── done ──────────────────────────────────────────────────────────────────────

echo
bold "═══════════════════════════════════════════"
green "  🚀 Deployment complete!"
bold "═══════════════════════════════════════════"
info "Project:  $PROJECT"
info "Commit:   $SHORT_COMMIT ($BRANCH)"
[[ -n "$preview_url" ]] && info "URL:      $preview_url"
echo
