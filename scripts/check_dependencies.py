from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parents[1]
LOADOUTS = json.loads((ROOT / "scripts" / "agent_loadouts.json").read_text(encoding="utf-8"))
AGENTS_ROOT = Path.home() / ".agents" / "skills"
CLAUDE_ROOT = Path.home() / ".claude" / "skills"


def main(argv):
    names = argv[1:] or sorted(LOADOUTS.keys())
    missing = []
    for agent in names:
        skills = LOADOUTS.get(agent, {}).get("skills")
        if skills is None:
            print(f"unknown agent: {agent}")
            missing.append(agent)
            continue
        for skill in skills:
            agent_path = AGENTS_ROOT / skill / "SKILL.md"
            claude_path = CLAUDE_ROOT / skill / "SKILL.md"
            if not agent_path.exists() or not claude_path.exists():
                print(f"{agent}: missing {skill}")
                missing.append(skill)
    if missing:
        raise SystemExit(1)
    print("all required skills are installed")


if __name__ == "__main__":
    main(sys.argv)
