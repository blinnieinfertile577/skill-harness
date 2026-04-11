---
name: "review-ready-check"
description: "Check whether a change is ready for review by testing the claimed behavior, summarizing risk, and naming any gaps reviewers should know about."
---

Use this skill before opening or updating a pull request.

Checklist:

- confirm the intended change set and user-visible outcome
- run or name the relevant validation evidence
- inspect diff shape for unrelated churn, hidden follow-up work, or missing tests
- summarize residual risk, especially where coverage is incomplete
- produce a short reviewer-facing summary of what changed and what to focus on

Review-ready means:

- the change has a clear purpose
- validation evidence exists and is specific
- known gaps are disclosed explicitly
- the reviewer does not need to reverse-engineer intent from the diff
