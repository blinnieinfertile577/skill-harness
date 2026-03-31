---
name: evidence-gap-review
description: Analyse specgraph verify output and identify what evidence is missing to advance specs to their next state.
---

Review the output of `specgraph verify` (or `specgraph verify --json`) and produce an actionable gap report.

## Procedure

1. Run `specgraph verify` (or read the provided output).
2. For each spec with status `WARN`, `FAIL`, or `INSUFFICIENT`:
   - Identify the required evidence dimension(s) that are unmet.
   - State the current evidence level and what level is needed.
   - Suggest the lowest-effort action that would provide the required evidence.
3. Group findings by effort: low (annotation), medium (test), high (architecture decision).

## Evidence-gap action map

| Required level | Unmet because | Recommended action |
|----------------|---------------|--------------------|
| E0 | No `@spec` annotation | Add `/** @spec ID @implements Feature */` to the implementation file |
| E1 | No closed Beads issue or structural artifact | Create a Beads issue with `--spec-id ID` and close it when done |
| E2 | Not indexed in specgraph DB / no linked artifact | Run `specgraph verify` to store claims, add cross-refs via `depends_on` |
| E3 | No test annotation | Add `/** @spec ID @verifies Feature */` to a test file |
| E4 | No CI artifact | Configure `freshness.artifacts` in `.specgraph/config.json` |

## Status meanings

| Status | Meaning |
|--------|---------|
| `PASS` | All required evidence thresholds met |
| `WARN` | Evidence exists but below required strength for this state |
| `FAIL` | No evidence found for a required dimension |
| `INSUFFICIENT` | Evidence found but strength is below required level (e.g. E0 found, E2 required) |
| `SKIP` | Spec has no evidence requirements (draft/deprecated) |
| `WAIVED` | Requirement waived — check expiry |

## Output format

For each gap, output:

```
SPEC-ID  [WARN|FAIL|INSUFFICIENT]  dimension=<name>  need=<Ex>  have=<Ey|none>
  → Action: <one-line description>
```

Then a prioritised action list (most impactful first).

## Useful drill-down commands

```bash
specgraph verify                     # summary table for all specs
specgraph verify --json              # machine-readable output
specgraph verify --spec SPEC-ID      # single spec only
specgraph explain SPEC-ID            # full claim breakdown for one spec
specgraph find --spec SPEC-ID        # locate files that reference a spec
specgraph find --relation IMPLEMENTS # all IMPLEMENTS claims
specgraph find --strength 1          # E1 and above
specgraph waivers                    # list active waivers
```

## Rules

1. Do not suggest adding waivers unless the requirement is genuinely unreachable.
2. Prefer adding annotations over creating new files.
3. If multiple specs share the same gap pattern, batch the fix into a single suggestion.
4. Check `specgraph explain <SPEC-ID>` for detailed claim breakdown when unsure what evidence exists.
5. Config file is `.specgraph/config.json` (falls back to `.agent-docs/config.json`).
