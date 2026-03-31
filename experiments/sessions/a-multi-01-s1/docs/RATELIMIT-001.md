---
id: RATELIMIT-001
title: "Login Rate Limiting"
state: in_progress
kind: functional
required_evidence:
  implementation: E0
waivers:
  - kind: missing-verification
    target: RATELIMIT-001
    owner: "agent"
    reason: "No VERIFIED_BY cross-reference claims exist yet. Beads issue tracking is not available in this session environment. Implementation is complete with passing tests; formal verification linkage deferred until Beads is available."
    expires: "2026-07-01"
  - kind: missing-models
    target: RATELIMIT-001
    owner: "agent"
    reason: "No structural models claims exist. This is a Session 3 in-memory rate limiting feature with no persistence layer; model-level evidence is out of scope."
    expires: "2026-07-01"
---

# RATELIMIT-001: Login Rate Limiting

## Overview

This spec defines the login rate limiting feature added to `auth.js` in Session 3 of the
multi-session compounding experiment. Rate limiting protects against brute-force password
attacks by locking out a username after too many consecutive failed login attempts.

Future agents building on top of this module MUST read AUTH-001.md and TASKS-001.md
before adding further features.

---

## Requirements

### RATELIMIT-001-01: Failure Tracking
- The system MUST track consecutive failed login attempts per username.
- Only failed attempts (wrong password or unknown username) count toward the limit.
- The failure record is stored as an array of timestamps (one per failure) in a
  module-level Map keyed by username.
- All state is in-memory only (no persistence).

### RATELIMIT-001-02: Lockout on 5th Consecutive Failure
- After **5 consecutive failed login attempts** for a username within any rolling
  **15-minute window**, further login attempts for that username MUST throw an `Error`
  with message `"Account locked: too many failed login attempts"`.
- The rolling window is evaluated from the first recorded failure: failures older than
  15 minutes are discarded before counting.
- If fewer than 5 failures remain within the window, the username is NOT locked out.
- The lockout expires naturally: once all 5 triggering failures fall outside the 15-minute
  window, the username becomes unlockable again.

### RATELIMIT-001-03: Reset on Successful Login
- A **successful login** MUST clear the failure record for that username, resetting
  the consecutive failure counter to zero.
- This means 4 failures followed by a successful login followed by more failures starts
  a fresh 5-attempt counter.

### RATELIMIT-001-04: Per-Username Isolation
- Lockout is scoped to the specific username.
- Locking out username A MUST NOT affect login attempts for username B.

### RATELIMIT-001-05: Test Helper
- The module MUST export `_clearRateLimiter()` for test isolation.
- This function clears the failure Map entirely.
- Production callers MUST NOT call this function (leading underscore convention).

---

## Data Structures

### Failure Record
```js
// Map<username, number[]>
// Each entry is an array of Date.now() timestamps for consecutive failures
// within the rolling window.
const _failureStore = new Map();
```

### Constants
```js
const MAX_FAILURES = 5;                        // failures before lockout
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;     // 15-minute rolling window
```

---

## Behavior Summary

| Scenario | Outcome |
|----------|---------|
| Fewer than 5 failures in 15 min | Login proceeds normally (null on bad credentials) |
| 5th failure within 15 min | throws "Account locked: too many failed login attempts" |
| Attempt while locked | throws "Account locked: too many failed login attempts" |
| Successful login | clears failure counter, returns token |
| Failures older than 15 min expire | lockout window resets (rolling window) |
| User A locked | User B unaffected |

---

## Module Interface Additions

```js
// auth.js — additions for RATELIMIT-001
export function _clearRateLimiter()   // TEST HELPER — resets the failure store only
```

The existing `_clearSessions()` does NOT clear the rate limiter store. Tests that
need a clean rate limiter state MUST call `_clearRateLimiter()` explicitly (or call
it together with `_clearSessions()`).

---

## Patterns Established

### Integration with login()
Rate limiting logic is injected at the start of `login()` and at the point of failure.
The flow is:
1. Check if username is currently locked out — if so, throw immediately.
2. Attempt authentication as before.
3. On failure, record a timestamp in the failure store.
4. On success, clear the failure store entry for the username and return the token.

### Rolling Window Evaluation
Before checking the failure count, prune timestamps older than `LOCKOUT_WINDOW_MS`
from the failure array. This ensures the window truly rolls rather than being fixed
from some arbitrary start time.

### Annotation Conventions
Follow the same patterns as the rest of `auth.js`:
```js
/**
 * @spec RATELIMIT-001-XX
 * @implements RATELIMIT-001-XX — <requirement text summary>
 * @evidence E0
 */
```

---

## Out of Scope for RATELIMIT-001
- Persistence (no SQLite, no file I/O)
- HTTP transport or middleware
- IP-based rate limiting
- Progressive backoff (exponential delays)
- Admin unlock endpoint
- Alerting or audit logging
- Rate limiting on any endpoint other than login

---

## Test Plan

Tests are in `ratelimit.test.js` using `node:test` and `node:assert/strict`.

| Test | Requirement |
|------|-------------|
| 5 consecutive failures throws lockout error | RATELIMIT-001-02 |
| 4 failures do not trigger lockout | RATELIMIT-001-02 |
| Lockout persists on subsequent attempt (6th, 7th, ...) | RATELIMIT-001-02 |
| Successful login clears failure counter | RATELIMIT-001-03 |
| 4 failures + success + 4 more failures = no lockout | RATELIMIT-001-03 |
| 4 failures + success + 5 more failures = lockout | RATELIMIT-001-03 |
| Locking user A does not lock user B | RATELIMIT-001-04 |
| Lockout expires after 15-minute window passes (time injection) | RATELIMIT-001-02 |
| Unknown username counts as a failure | RATELIMIT-001-01 |
