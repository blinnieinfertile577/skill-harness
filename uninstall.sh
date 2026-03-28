#!/usr/bin/env bash
set -euo pipefail
AGENTS=(requirements-analyst ux-researcher system-modeler software-architect web-engineer backend-engineer test-designer qa-automation-engineer quality-reviewer security-reviewer pentest-reviewer delivery-manager research-writer)
for agent in "${AGENTS[@]}"; do
  rm -f "$HOME/.claude/agents/$agent.md" "$HOME/.codex/agents/$agent.toml"
done
