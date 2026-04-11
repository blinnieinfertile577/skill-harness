# Repo Placement

The right model is central workflow ownership with flexible pack placement.

## Recommendation

- Keep `skill-harness` as the canonical source of truth for shared workflow agents, install tooling, and embedded suite-local packs.
- Keep external pack repos as optional dependency sources when a pack already has its own lifecycle.
- Use repo-local `packs/` directories for incubating capabilities, suite-local workflows, or packs that do not justify their own repository yet.

## Why

- The agents are cross-pack compositions, so they still belong here.
- Some capabilities are easier to evolve inside the harness before they deserve a separate repo.
- A central harness repo keeps dependency management, install flows, and pack discovery coherent even when packs come from mixed sources.

## Pack placement rule

- Shared workflow agents: keep in `skill-harness`.
- Embedded packs under `packs/`: use for incubating, suite-local, or newly imported capabilities.
- External pack repos: keep using them when they already exist and have clear ownership outside this repo.

## Practical rule

- Start new or imported capabilities as embedded packs unless there is an immediate reason for separate repository ownership.
- Split a pack into its own repo only when it needs an independent lifecycle, separate maintainers, or reuse outside the harness.
- Do not duplicate the same pack in both an embedded directory and a separate repo.

## Current decision

`skill-harness` remains the suite entrypoint, and it now supports a hybrid model: remote dependency packs plus embedded local packs under `packs/`.
