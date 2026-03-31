---
name: spec-writer
description: Write specgraph spec documents with correct YAML frontmatter, evidence requirements, and section structure.
---

Write a spec document for the feature or component described. Place it in `docs/` with a `.md` extension.

Spec sources: `docs/` is the primary directory. `specs/` is a legacy fallback.

## Required frontmatter fields

```yaml
---
id: <UPPERCASE-KEBAB-000>          # unique ID, e.g. AUTH-001
title: "Human-readable title"
state: draft | proposed | in_progress | accepted | done | deprecated
kind: functional | non_functional | architecture | interface | constraint
required_evidence:
  implementation: E0               # minimum evidence strength needed
  # add more dimensions as needed: verification, models, apis
# optional:
depends_on: [OTHER-001]            # IDs this spec depends on
conflicts_with: [OTHER-002]        # IDs this spec conflicts with
owner: "Team or person"
tags: [auth, security]
---
```

## Evidence strength reference

| Level | Name | Source |
|-------|------|--------|
| E0 | Declarative | `@spec`/`@implements` JSDoc annotation |
| E1 | Structural | Beads closed issue; file/symbol reference |
| E2 | Indexed | Stored in specgraph DB; linked artifact |
| E3 | Automated | Passing test suite with `@spec` annotation |
| E4 | Runtime | CI artifact, coverage report, live probe |

## State guidance

| State | Policy | Notes |
|---|---|---|
| `draft` | Always passes | No evidence required — early exploration |
| `proposed` | Advisory | Warns if no implementation found |
| `in_progress` | E1 implementation required | Verification is advisory |
| `accepted` | E2 impl + E2 verification + E1 models | Full evidence required |
| `done` | E3 impl + E3 verification + E2 models | High-confidence evidence |
| `deprecated` | Always passes | No longer enforced |

## Evidence dimensions

The `required_evidence` block accepts any combination of:

| Dimension | What it tracks |
|---|---|
| `implementation` | Code that implements the spec |
| `verification` | Tests that verify the spec |
| `models` | Data models referenced by the spec |
| `apis` | API endpoints implementing the spec |

## Inline waiver format (frontmatter)

```yaml
waivers:
  - kind: missing-verification
    target: "*"
    owner: eng-lead
    reason: "No automated tests yet — deferred to milestone 3"
    expires: "2026-12-31"
```

Do not add waivers to the frontmatter directly for complex cases — use `specgraph waivers` or standalone `docs/waivers/<SPEC-ID>-<dimension>.md` files instead.

## Rules

1. Choose the smallest evidence requirement that still provides meaningful signal.
2. Keep `id` stable — downstream annotations and Beads issues reference it.
3. Write section body in imperative: "The system SHALL…", "The API MUST…".
4. Add `depends_on` when this spec only makes sense after another is satisfied.
5. Add `conflicts_with` when this spec is mutually exclusive with another.
6. Place spec files in `docs/` — this is the primary scanned directory.
