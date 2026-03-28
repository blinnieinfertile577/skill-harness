from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
LOADOUTS = json.loads((ROOT / "scripts" / "agent_loadouts.json").read_text(encoding="utf-8"))
SOURCE = ROOT / ".codex" / "agents"
TARGET = Path.home() / ".codex" / "agents"
SKILL_ROOT = Path.home() / ".agents" / "skills"
TARGET.mkdir(parents=True, exist_ok=True)
for name, cfg in LOADOUTS.items():
    src = SOURCE / f"{name}.toml"
    text = src.read_text(encoding="utf-8").rstrip() + "\n\n"
    for skill in cfg["skills"]:
        skill_path = (SKILL_ROOT / skill / "SKILL.md").resolve()
        text += "[[skills.config]]\n"
        text += f"path = {json.dumps(str(skill_path))}\n"
        text += "enabled = true\n\n"
    (TARGET / f"{name}.toml").write_text(text, encoding="utf-8", newline="\n")
    print(f"rendered {name}.toml -> {TARGET}")
