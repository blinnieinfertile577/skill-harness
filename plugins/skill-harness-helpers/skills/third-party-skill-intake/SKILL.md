---
name: "third-party-skill-intake"
description: "Review third-party skill repos for format fit, provenance, and first-party adoption paths without treating them as direct harness dependencies."
---

Use this skill when reviewing public skill repos for possible 45ck adoption.

Rules:

- clone external repos outside the current repo
- treat stars, size, and popularity as weak signals, not proof
- separate format guidance, install tooling ideas, and actual skill content
- compare against the current first-party catalog before proposing imports
- never add third-party repos directly to the harness dependency list without an explicit ownership decision

Checklist:

- identify repo type: official reference, install/distribution tooling, curated index, or skill pack
- verify license, provenance, and whether helper scripts assume unsafe autonomy
- inventory install surface: copy-only, plugin marketplace, CLI installer, project-local install, global install
- note whether the repo contains skills, agents, plugin manifests, helper scripts, or only links
- map each worthwhile pattern to one destination:
  - `skill-harness` helper/plugin/tooling
  - a specific embedded pack under `packs/`
  - reject or monitor only

Output:

- short repo matrix
- notable opportunities
- risks and rewrite requirements
- exact first-party destination for each recommended adoption

Avoid:

- copying whole third-party catalogs into this repo
- confusing discovery indexes with install-ready dependencies
- recommending direct integration when a manual port is the safer path
