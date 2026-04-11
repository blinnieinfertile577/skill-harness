---
name: "gh-review-followthrough"
description: "Address GitHub PR review threads or issue comments with explicit comment selection, repo-grounded fixes, and concise reply-ready summaries."
---

Use this skill when the user wants comments on a GitHub pull request or issue addressed.

Process:

- verify the current branch or explicit PR maps to the right repository context
- gather open review threads or issue comments before touching code
- summarize each thread by required change, likely file scope, and any ambiguity
- have the user confirm which comments to act on when multiple threads exist
- implement only the chosen fixes, then summarize what changed and how to reply

What good looks like:

- comment handling is grouped by thread, not a random code diff
- each fix is grounded in the actual code and current reviewer request
- unresolved ambiguity is surfaced before edits, not after
- final output is ready to turn into review replies or a PR update

Avoid:

- replying to every comment with the same generic status line
- collapsing multiple unrelated review threads into one vague fix
- applying speculative changes that were not requested
