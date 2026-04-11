---
name: "issue-driven-delivery"
description: "Run implementation work from a tracked issue with explicit scope, branch intent, validation steps, and closeout evidence."
---

Use this skill when a task should be executed against a concrete issue or ticket instead of vague chat intent.

Workflow:

- identify the governing issue, ticket, or work item before changing code
- restate the expected outcome, scope edge, and what is explicitly out of scope
- inspect existing code, tests, and docs before proposing edits
- decide the smallest implementation slice that can be verified end to end
- name the evidence needed before the work can be called done

Checklist:

- confirm the ticket or issue id and current status
- note linked PRs, comments, or acceptance criteria if they exist
- identify the files or subsystems likely to change
- list the validation path: tests, manual checks, or CI evidence
- end with a closeout note that ties the result back to the issue

Avoid:

- implementing from memory without reading the current code
- silently broadening scope because nearby problems look related
- claiming completion without validation evidence
