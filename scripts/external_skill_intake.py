from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INTAKE_ROOT = REPO_ROOT.parent / "skill-intake"
DEFAULT_LOCAL_SKILLS_ROOT = Path.home() / ".agents" / "skills"


@dataclass
class RepoSummary:
    name: str
    path: Path
    skill_names: list[str]
    agent_file_count: int
    plugin_manifest_count: int
    install_surface: str
    overlap_names: list[str]
    unique_names: list[str]


def find_skill_names(repo_root: Path) -> list[str]:
    return sorted(
        {
            skill_md.parent.name
            for skill_md in repo_root.rglob("SKILL.md")
            if skill_md.is_file()
        }
    )


def count_agent_files(repo_root: Path) -> int:
    count = 0
    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".md", ".toml"}:
            continue
        normalized = path.as_posix().lower()
        if (
            "/.claude/agents/" in normalized
            or "/.codex/agents/" in normalized
            or normalized.endswith("/agents.md")
            or "/agents/" in normalized
        ):
            count += 1
    return count


def count_plugin_manifests(repo_root: Path) -> int:
    return sum(1 for path in repo_root.rglob("plugin.json") if path.is_file())


def readme_text(repo_root: Path) -> str:
    for name in ("README.md", "readme.md"):
        candidate = repo_root / name
        if candidate.exists():
            return candidate.read_text(encoding="utf-8", errors="ignore")
    return ""


def detect_install_surface(repo_root: Path, readme: str) -> str:
    normalized = readme.lower()
    surfaces: list[str] = []

    if "plugin marketplace" in normalized or "/plugin install" in normalized:
        surfaces.append("plugin")
    if "npx skills" in normalized or "agent-skills-cli" in normalized:
        surfaces.append("cli")
    if "skill-installer" in normalized:
        surfaces.append("catalog")
    if "install.sh" in normalized or (repo_root / "install.sh").exists():
        surfaces.append("script")
    if (
        ".codex/skills" in normalized
        or ".claude/skills" in normalized
        or "$codex_home/skills" in normalized
        or "$codeX_home/skills".lower() in normalized
    ):
        surfaces.append("copy")
    if "curated list" in normalized or "awesome" in normalized:
        surfaces.append("index")

    ordered = []
    for value in surfaces:
        if value not in ordered:
            ordered.append(value)
    return ",".join(ordered) if ordered else "unknown"


def local_skill_names(local_root: Path) -> list[str]:
    if not local_root.exists():
        return []
    return sorted(
        {
            path.name
            for path in local_root.iterdir()
            if path.is_dir() and not path.name.startswith(".")
        }
    )


def summarize_repo(repo_root: Path, local_names: set[str]) -> RepoSummary:
    skills = find_skill_names(repo_root)
    overlap = sorted([name for name in skills if name in local_names])
    unique = sorted([name for name in skills if name not in local_names])
    readme = readme_text(repo_root)
    return RepoSummary(
        name=repo_root.name,
        path=repo_root,
        skill_names=skills,
        agent_file_count=count_agent_files(repo_root),
        plugin_manifest_count=count_plugin_manifests(repo_root),
        install_surface=detect_install_surface(repo_root, readme),
        overlap_names=overlap,
        unique_names=unique,
    )


def find_repo_roots(paths: list[str], intake_root: Path) -> list[Path]:
    if paths:
        return [Path(path).resolve() for path in paths]
    if not intake_root.exists():
        return []
    return sorted([path for path in intake_root.iterdir() if path.is_dir()], key=lambda p: p.name.lower())


def markdown_table(summaries: list[RepoSummary]) -> list[str]:
    lines = [
        "| Repo | Skills | Agent files | Plugin manifests | Overlap | Unique | Install surface |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for summary in summaries:
        lines.append(
            f"| `{summary.name}` | {len(summary.skill_names)} | {summary.agent_file_count} | "
            f"{summary.plugin_manifest_count} | {len(summary.overlap_names)} | {len(summary.unique_names)} | "
            f"{summary.install_surface} |"
        )
    return lines


def repo_section(summary: RepoSummary, sample_size: int) -> list[str]:
    unique_sample = ", ".join(summary.unique_names[:sample_size]) if summary.unique_names else "none"
    overlap_sample = ", ".join(summary.overlap_names[:sample_size]) if summary.overlap_names else "none"
    return [
        f"### {summary.name}",
        f"- Path: `{summary.path}`",
        f"- Skills: {len(summary.skill_names)}",
        f"- Agent files: {summary.agent_file_count}",
        f"- Plugin manifests: {summary.plugin_manifest_count}",
        f"- Install surface: `{summary.install_surface}`",
        f"- Sample unique skills: {unique_sample}",
        f"- Sample overlapping skills: {overlap_sample}",
        "",
    ]


def format_report(summaries: list[RepoSummary], local_root: Path, sample_size: int) -> str:
    lines = [
        "# External Skill Intake Report",
        "",
        f"- Local comparison root: `{local_root}`",
        f"- Repos scanned: {len(summaries)}",
        "",
        "## Summary",
        "",
    ]
    lines.extend(markdown_table(summaries))
    lines.append("")
    lines.append("## Repo Notes")
    lines.append("")
    for summary in summaries:
        lines.extend(repo_section(summary, sample_size))
    return "\n".join(lines).rstrip() + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan external skill repos and compare their skill names with the local 45ck-installed catalog."
    )
    parser.add_argument(
        "repos",
        nargs="*",
        help="Repo roots to scan. Defaults to every directory under --intake-root.",
    )
    parser.add_argument(
        "--intake-root",
        default=str(DEFAULT_INTAKE_ROOT),
        help="Fallback directory containing cloned external repos.",
    )
    parser.add_argument(
        "--local-skills-root",
        default=str(DEFAULT_LOCAL_SKILLS_ROOT),
        help="Local skills directory used for overlap checks.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=12,
        help="How many sample skill names to print per repo.",
    )
    parser.add_argument(
        "--output",
        help="Write the markdown report to this file instead of stdout only.",
    )
    return parser.parse_args(argv[1:])


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    intake_root = Path(args.intake_root).resolve()
    local_root = Path(args.local_skills_root).resolve()

    repo_roots = find_repo_roots(args.repos, intake_root)
    if not repo_roots:
        print("no repos found to scan", file=sys.stderr)
        return 1

    local_names = set(local_skill_names(local_root))
    summaries = [summarize_repo(repo_root, local_names) for repo_root in repo_roots]
    report = format_report(summaries, local_root, sample_size=max(args.sample_size, 1))
    print(report, end="")

    if args.output:
        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8", newline="\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
