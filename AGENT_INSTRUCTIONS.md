# Agent Instructions

Use this file when another agent needs to install `skill-harness` correctly without guessing.

## Goal

Install the `skill-harness` suite so that:

- dependent pack repos are cloned into `~/.skill-harness/packs/`
- skills are synced into `~/.claude/skills/` and `~/.agents/skills/`
- Claude agents are installed into `~/.claude/agents/`
- Codex agents are rendered into `~/.codex/agents/`

## Preferred install path

If Go is available:

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

## Fallback install path

If you should not build the binary, run the wrapper scripts from the repo root.

```bash
bash install.sh
```

```powershell
.\install.ps1
```

Those wrappers call the Go CLI via `go run`.

## Selective install

Install only selected agents:

```bash
./skill-harness install --agents=requirements-analyst,system-modeler,security-reviewer
```

Install only selected packs:

```bash
./skill-harness install --packs=business-analysis-skills,documentation-evidence-skills --packs-only
```

Use the interactive installer:

```bash
./skill-harness install --interactive
```

## Verification

After install, run:

```bash
./skill-harness check --all
```

Or for a subset:

```bash
./skill-harness check --agents=requirements-analyst,system-modeler
```

## Important rules

- Run commands from the repo root.
- Do not manually copy skill directories if the CLI or wrappers can do it.
- Do not assume the pack repos are already installed.
- Let `skill-harness` bootstrap dependencies itself.
- If validation fails because of bad installed `SKILL.md` files, rerun the install path first before patching individual skills.

## Useful files

- [README.md](README.md)
- [cmd/skill-harness/main.go](cmd/skill-harness/main.go)
- [scripts/dependencies.json](scripts/dependencies.json)
- [scripts/bootstrap_dependencies.py](scripts/bootstrap_dependencies.py)
- [scripts/check_dependencies.py](scripts/check_dependencies.py)
