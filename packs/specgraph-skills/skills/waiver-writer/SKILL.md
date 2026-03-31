---
name: waiver-writer
description: Write a specgraph evidence waiver for a spec requirement that cannot currently be satisfied, with a clear justification and expiry plan.
---

Write an evidence waiver that records why a spec requirement is being bypassed and when it should be revisited.

## When to use a waiver

Only create a waiver when:
- The required evidence is architecturally impossible (e.g., E4 for a design-only spec)
- The evidence will be deferred to a future milestone with a known date
- A conscious risk decision has been made and approved

Do **not** waive requirements just because they're inconvenient. Prefer lowering the `required_evidence` threshold in the spec instead.

## Inline waiver format (spec frontmatter)

```yaml
waivers:
  - kind: missing-verification     # e.g. missing-verification, missing-implementation
    target: "*"                    # dimension or subject targeted
    owner: eng-lead                # accountable person or team (not a role title)
    reason: "Human-readable justification — why this is acceptable"
    expires: "2026-09-30"          # ISO date after which the waiver must be renewed
```

After adding, run `specgraph waivers` to confirm the waiver is recognized.

## Standalone waiver file

Create a file at `docs/waivers/<SPEC-ID>-<dimension>.md`:

```markdown
---
spec_id: SPEC-001
dimension: implementation
reason: "Detailed justification"
expires: "2026-09-30"
approved_by: "Team Lead"
---

## Context

Explain the architectural or timeline constraint that makes this evidence unreachable.

## Risk acknowledgement

State what risk is accepted by waiving this requirement.

## Renewal condition

Describe what must be true before this waiver is renewed or removed.
```

Use a standalone file when:
- The justification is long or references external documents
- The spec is in `accepted` state (stronger justification required)
- Multiple dimensions need separate waivers with different owners

## Checking waivers

```bash
specgraph waivers            # list all active waivers
specgraph waivers SPEC-001   # waivers for one spec
```

## Rules

1. Set `expires` no more than 90 days out unless there is a documented milestone dependency.
2. `owner` / `approved_by` must name an accountable person or team, not a role title.
3. The `reason` must be self-contained — it should make sense without reading other context.
4. After adding a waiver, run `specgraph waivers` to confirm it is recognized.
5. Waivers for `accepted`-state specs require stronger justification than `in_progress` specs.
6. Config file is `.specgraph/config.json` (falls back to `.agent-docs/config.json`).
