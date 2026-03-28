$agents = @('requirements-analyst','ux-researcher','system-modeler','software-architect','web-engineer','backend-engineer','test-designer','qa-automation-engineer','quality-reviewer','security-reviewer','pentest-reviewer','delivery-manager','research-writer')
foreach ($agent in $agents) {
  Remove-Item -LiteralPath (Join-Path $HOME ".claude\agents\$agent.md") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $HOME ".codex\agents\$agent.toml") -Force -ErrorAction SilentlyContinue
}
