#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME/.claude/agents" "$HOME/.codex/agents"
cp "$SCRIPT_DIR"/.claude/agents/*.md "$HOME/.claude/agents/"
python "$SCRIPT_DIR/scripts/render_codex_agents.py"
echo "Installed Claude agents to $HOME/.claude/agents"
echo "Rendered Codex agents to $HOME/.codex/agents"
