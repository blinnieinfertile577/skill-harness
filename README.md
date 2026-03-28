# skill-harness

<p align="center">
  <img src="logo.svg" alt="skill-harness logo" width="128" height="128" />
</p>

`skill-harness` is the umbrella repo for the skill-pack suite. It installs the shared skills from the pack repos, then installs the shared Claude and Codex agents that sit on top of them.

## What this repo gives you

- one place to install the suite
- shared multi-pack agents for Claude and Codex
- dependency bootstrap for the pack repos
- a Go CLI for installing everything or only what you want

## Install

You can install it in any of these ways.

### 1. Build the CLI and use it directly

```bash
git clone https://github.com/45ck/skill-harness.git
cd skill-harness
go build -o skill-harness ./cmd/skill-harness
./skill-harness install --all
```

Windows:

```powershell
git clone https://github.com/45ck/skill-harness.git
cd skill-harness
go build -o skill-harness.exe .\cmd\skill-harness
.\skill-harness.exe install --all
```

### 2. Use the wrapper scripts

```bash
bash install.sh
```

```powershell
.\install.ps1
```

### 3. Install only what you need

Selected agents:

```bash
./skill-harness install --agents=requirements-analyst,system-modeler,security-reviewer
```

Selected packs only:

```bash
./skill-harness install --packs=business-analysis-skills,documentation-evidence-skills --packs-only
```

Interactive picker:

```bash
./skill-harness install --interactive
```

### 4. Let another agent install it for you

Point the agent at [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) and tell it to follow that file exactly.

## Included agents

- `requirements-analyst`: requirements clarification, assumptions, acceptance criteria, prioritization
- `requirements-analyst-beads`: same domain, but outputs trackable follow-up items
- `ux-researcher`: personas, task analysis, usability planning, prototype feedback
- `system-modeler`: use cases, sequence/activity/state diagrams, model consistency
- `system-modeler-beads`: same domain, but outputs trackable follow-up items
- `software-architect`: architecture options, ADRs, tradeoffs, runtime and deployment views
- `software-architect-beads`: same domain, but outputs trackable follow-up items
- `web-engineer`: routes, controllers, validation, request/response flow, MVC boundaries
- `backend-engineer`: entities, repositories, transactions, API contracts, schema design
- `test-designer`: EP/BVA, decision tables, state-based tests, coverage and oracles
- `test-designer-beads`: same domain, but outputs trackable follow-up items
- `qa-automation-engineer`: unit, integration, API, UI, fixtures, regression suites
- `quality-reviewer`: code review, technical debt, code smells, rework planning
- `security-reviewer`: threat surfaces, trust boundaries, auth, secrets, prompt/tool risks
- `security-reviewer-beads`: same domain, but outputs trackable follow-up items
- `pentest-reviewer`: authorized security testing, recon, findings, repro, remediation priority
- `delivery-manager`: sprint goals, backlog quality, risk, release and maintenance readiness
- `delivery-manager-beads`: same domain, but outputs trackable follow-up items
- `research-writer`: search strategy, source screening, related work, evidence synthesis

## Included pack repos

The harness bootstraps pack repos into `~/.skill-harness/packs/` and syncs their skills into:

- `~/.claude/skills/`
- `~/.agents/skills/`

Current dependent pack repos:

- `agile-delivery-skills`
- `authentication-cryptography-skills`
- `automation-testing-skills`
- `backend-persistence-skills`
- `business-analysis-skills`
- `code-review-inspection-skills`
- `data-structures-algorithmic-reasoning-skills`
- `deployment-release-skills`
- `design-for-testability-skills`
- `documentation-evidence-skills`
- `enterprise-architecture-integration-skills`
- `hci-review-skill`
- `llm-agent-security-skills`
- `maintenance-evolution-skills`
- `non-functional-testing-skills`
- `oop-code-structure-skills`
- `pentest-security-testing-skills`
- `project-management-skills`
- `refactoring-code-smells-skills`
- `research-literature-review-skills`
- `security-engineering-skills`
- `software-architecture-skills`
- `software-quality-skills`
- `uml-analysis-modelling-skills`
- `verification-test-design-skills`
- `web-engineering-skills`

## Commands

- `./skill-harness list`
- `./skill-harness install --all`
- `./skill-harness install --interactive`
- `./skill-harness install --agents=a,b`
- `./skill-harness install --packs=x,y --packs-only`
- `./skill-harness check --agents=a,b`
- `./skill-harness render --agents=a,b`
- `./skill-harness uninstall --agents=a,b`

## Files

- [cmd/skill-harness/main.go](cmd/skill-harness/main.go): Go CLI
- [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md): exact instructions for another agent to install it correctly
- [docs/agent-loadouts.md](docs/agent-loadouts.md): agent-to-skill mapping
- [scripts/dependencies.json](scripts/dependencies.json): repo dependency map

## License

[MIT](LICENSE)
