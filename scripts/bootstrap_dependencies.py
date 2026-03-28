from pathlib import Path
import json
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "scripts" / "dependencies.json").read_text(encoding="utf-8"))
HOME = Path.home()
CACHE_ROOT = HOME / ".workflow-agents" / "packs"
CLAUDE_ROOT = HOME / ".claude" / "skills"
AGENTS_ROOT = HOME / ".agents" / "skills"


def run(cmd, cwd=None):
    subprocess.run(cmd, check=True, cwd=cwd)


def clone_or_pull(repo_name: str, url: str) -> Path:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    repo_dir = CACHE_ROOT / repo_name
    if (repo_dir / ".git").exists():
        print(f"updating {repo_name}")
        run(["git", "pull", "--ff-only"], cwd=repo_dir)
    else:
        print(f"cloning {repo_name}")
        run(["git", "clone", url, str(repo_dir)])
    return repo_dir


def sync_tree(src_root: Path, dst_root: Path):
    if not src_root.exists():
        return
    dst_root.mkdir(parents=True, exist_ok=True)
    for skill_dir in sorted([p for p in src_root.iterdir() if p.is_dir()]):
        target = dst_root / skill_dir.name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(skill_dir, target)


def install_repo(repo_dir: Path):
    sync_tree(repo_dir / ".claude" / "skills", CLAUDE_ROOT)
    sync_tree(repo_dir / ".agents" / "skills", AGENTS_ROOT)


def required_repos(selected_agents):
    if not selected_agents:
        return sorted(CONFIG["repos"].keys())
    needed = set()
    for agent in selected_agents:
        if agent not in CONFIG["agents"]:
            raise SystemExit(f"unknown agent: {agent}")
        needed.update(CONFIG["agents"][agent]["repos"])
    return sorted(needed)


def main(argv):
    selected_agents = argv[1:]
    repos = required_repos(selected_agents)
    for repo_name in repos:
        repo_dir = clone_or_pull(repo_name, CONFIG["repos"][repo_name]["url"])
        install_repo(repo_dir)
    print(f"installed dependencies for {len(repos)} pack repos")


if __name__ == "__main__":
    main(sys.argv)
