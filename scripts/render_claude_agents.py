import argparse
from pathlib import Path
import json
import sys
from typing import List

ROOT = Path(__file__).resolve().parents[1]
LOADOUTS = json.loads((ROOT / "scripts" / "agent_loadouts.json").read_text(encoding="utf-8"))
SOURCE = ROOT / ".claude" / "agents"
TARGET = Path.home() / ".claude" / "agents"
TARGET.mkdir(parents=True, exist_ok=True)


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("agents", nargs="*", help="Backward-compatible agent names.")
    parser.add_argument("--agent", action="append", dest="agent_flags", default=[], help="Agent to render.")
    parser.add_argument("--all", action="store_true", help="Render every configured agent.")
    return parser.parse_args(argv[1:])


def rewrite_skills(text: str, skills: List[str]) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise SystemExit("expected YAML frontmatter in Claude agent template")
    try:
        closing_index = lines[1:].index("---") + 1
    except ValueError as exc:
        raise SystemExit("missing closing YAML frontmatter delimiter in Claude agent template") from exc

    frontmatter = lines[1:closing_index]
    body = lines[closing_index + 1 :]

    rewritten_frontmatter: list[str] = []
    skipping_skills = False
    for line in frontmatter:
        stripped = line.strip()
        if stripped == "skills:":
            skipping_skills = True
            continue
        if skipping_skills and line.startswith("  - "):
            continue
        skipping_skills = False
        rewritten_frontmatter.append(line)

    if rewritten_frontmatter and rewritten_frontmatter[-1].strip():
        rewritten_frontmatter.append("skills:")
    else:
        rewritten_frontmatter.extend(["skills:"])
    rewritten_frontmatter.extend([f"  - {skill}" for skill in skills])

    rendered_lines = ["---", *rewritten_frontmatter, "---", *body]
    return "\n".join(rendered_lines).rstrip() + "\n"


def main(argv):
    args = parse_args(argv)
    selected = list(dict.fromkeys(args.agents + args.agent_flags))
    if args.all or not selected:
        selected = sorted(LOADOUTS.keys())
    for name in selected:
        cfg = LOADOUTS.get(name)
        if cfg is None:
            raise SystemExit(f"unknown agent: {name}")
        src = SOURCE / f"{name}.md"
        text = src.read_text(encoding="utf-8")
        rendered = rewrite_skills(text, cfg["skills"])
        (TARGET / f"{name}.md").write_text(rendered, encoding="utf-8", newline="\n")
        print(f"rendered {name}.md -> {TARGET}")


if __name__ == "__main__":
    main(sys.argv)
