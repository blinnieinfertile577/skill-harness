# workflow-agents

<p align="center">
  <img src="logo.svg" alt="workflow-agents logo" width="128" height="128" />
</p>

<p align="center">
  <img src="banner.svg" alt="workflow-agents banner" width="100%" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/claude_agents-13-2563eb" alt="13 Claude agents" />
  <img src="https://img.shields.io/badge/codex_agents-13-1d4ed8" alt="13 Codex agents" />
</p>

A workflow-oriented agent layer built on top of the skill-pack repositories. It ships role-based Claude and Codex agents with curated loadouts rather than one agent per pack.

## Included agents

- `requirements-analyst`
- `ux-researcher`
- `system-modeler`
- `software-architect`
- `web-engineer`
- `backend-engineer`
- `test-designer`
- `qa-automation-engineer`
- `quality-reviewer`
- `security-reviewer`
- `pentest-reviewer`
- `delivery-manager`
- `research-writer`

## Structure

```text
.claude/agents/*.md               Claude subagents with preloaded skill lists
.codex/agents/*.toml              Codex custom agent profiles
docs/agent-loadouts.md            Curated skill mapping per agent
scripts/render_codex_agents.py    Renders Codex agents with local skills.config paths
install.sh / install.ps1          Installs Claude agents and renders Codex agents
uninstall.sh / uninstall.ps1      Removes installed agent files
AGENTS.md                         Root guidance for the agent layer
```

## Install

```bash
git clone https://github.com/45ck/workflow-agents.git
cd workflow-agents
bash install.sh
```

On Windows:

```powershell
git clone https://github.com/45ck/workflow-agents.git
cd workflow-agents
.\install.ps1
```

The relevant skill packs should already be installed under `~/.agents/skills/` and `~/.claude/skills/`.

## Design

- Packs are the source library.
- Agents are thin workflow workers with curated loadouts.
- Claude agents preload only a tight skill list because those skills are injected into context at startup.
- Codex agents stay role-scoped and can be rendered with explicit `skills.config` entries for local installations.

## Loadout map

See [docs/agent-loadouts.md](docs/agent-loadouts.md).

## License

[MIT](LICENSE)
