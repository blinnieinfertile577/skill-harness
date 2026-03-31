---
name: verify-interpreter
description: Interpret the output of `specgraph verify` and explain what each status means and what to do next.
---

Read and explain the output of `specgraph verify` in plain language, then recommend next steps.

## Status meanings

| Status | Meaning | Action |
|--------|---------|--------|
| `PASS` | All required evidence thresholds met | Nothing required |
| `WARN` | Evidence exists but below required strength for this state | Strengthen evidence or lower requirement |
| `FAIL` | No evidence found for a required dimension | Add evidence or add waiver |
| `INSUFFICIENT` | Evidence found but strength is below required level | Raise evidence strength (e.g. E0 → E2) |
| `SKIP` | Spec has no evidence requirements (draft/deprecated) | Review if state is correct |
| `WAIVED` | Requirement waived — check expiry | Verify waiver is still valid |

### Example output

```
  PASS          FEAT-001  [accepted]
  WARN          FEAT-002  [in_progress]
                 warn: No verification claims found (advisory)
  FAIL          FEAT-003  [accepted]
                 fail: No implementation claims found. Required: E2 (indexed)
  INSUFFICIENT  FEAT-004  [accepted]
                 insufficient-evidence: implementation: found E0 but required E2
```

## Verify commands reference

```bash
specgraph verify                         # summary table for all specs
specgraph verify --spec FEAT-001         # single spec only
specgraph verify --json                  # machine-readable output
specgraph verify --changed src/foo.ts    # incremental scan (changed files only)
specgraph verify --no-db                 # dry run — skip writing to DB
specgraph explain <SPEC-ID>              # full claim breakdown for one spec
specgraph explain                        # all specs
specgraph find --spec FEAT-001           # locate files that reference a spec
specgraph find --relation IMPLEMENTS     # all IMPLEMENTS claims
specgraph find --provider annotation     # claims from a specific provider
specgraph find --strength 1              # E1 and above
specgraph waivers                        # list active waivers
specgraph waivers FEAT-001               # waivers for one spec
specgraph subject issue:beads:bd-a1b2    # show a specific Beads issue's claims
specgraph subject symbol:annotation:MyClass  # show a symbol's claims
```

Subject IDs follow the format `kind:provider:identity` (e.g. `issue:beads:bd-a1b2`, `symbol:annotation:TodoStore`).

## Interpretation checklist

1. Count PASS / WARN / FAIL / INSUFFICIENT counts — overall health indicator.
2. For each FAIL: run `specgraph explain <ID>` to see what claims exist.
3. For each INSUFFICIENT: check the `required_evidence` threshold in the spec frontmatter — lower it or add stronger evidence.
4. For each WARN: check if the evidence level matches the spec's `state` requirements.
5. Check waiver expiry dates — expired waivers flip to WARN/FAIL.
6. Confirm provider scans are recent — stale scan data can hide real gaps.

## Common causes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| All specs FAIL | Annotations not scanned | Run `specgraph verify` again; check `@spec` syntax |
| INSUFFICIENT on `accepted` specs | Evidence is E0/E1, need E2+ | Add cross-refs or tests to raise strength |
| WARN on `accepted` specs | Evidence is E0/E1, need E2+ | Add cross-refs or tests |
| Unexpected PASS | Waiver is covering a gap | Check `specgraph waivers` for active waivers |
| Missing specs in output | Spec file not in `docs/` | Check path and `.specgraph/config.json` |
| Beads claims missing | Beads not enabled | Set `beads.enabled: true` in `.specgraph/config.json` |

## Rules

1. Never dismiss a FAIL without understanding the root cause.
2. Use `specgraph explain` before deciding whether to add evidence or a waiver.
3. Report the exact spec IDs and dimensions in any gap summary you produce.
4. Config file is `.specgraph/config.json` (falls back to `.agent-docs/config.json`).
