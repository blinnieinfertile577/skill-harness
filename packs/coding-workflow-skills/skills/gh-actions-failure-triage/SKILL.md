---
name: "gh-actions-failure-triage"
description: "Inspect failing GitHub Actions checks, isolate the actionable failure, and turn it into a concrete fix path with verification steps."
---

Use this skill when CI is failing in GitHub Actions and the user wants the failure understood or fixed.

Process:

- identify the failing workflow, job, and step rather than saying only that CI is red
- pull the smallest useful failure snippet and the command or assertion that failed
- separate infrastructure noise from an actual code or test regression
- map the failure to the local file or behavior most likely responsible
- define the cheapest local verification before rerunning CI

Deliver:

- failing workflow and job
- short failure summary
- likely root-cause area
- proposed fix path
- exact verification steps to run locally first

Avoid:

- dumping huge logs without synthesis
- treating every failure as a code defect when the runner or external service is the real problem
- changing unrelated code just to make the pipeline go green
