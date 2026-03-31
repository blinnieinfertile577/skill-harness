---
id: AUTH-001
title: "Authentication Module"
state: in_progress
kind: functional
required_evidence:
  implementation: E0
waivers:
  - kind: missing-verification
    target: AUTH-001
    owner: "agent"
    reason: "No VERIFIED_BY cross-reference claims exist yet. Beads issue tracking is not available in this session environment. Implementation is complete with 16 passing tests; formal verification linkage deferred until Beads is available."
    expires: "2026-07-01"
  - kind: missing-models
    target: AUTH-001
    owner: "agent"
    reason: "No structural models claims exist. This is a Session 1 foundation module with no persistence layer; model-level evidence is out of scope."
    expires: "2026-07-01"
---

# AUTH-001: Authentication Module

## Overview

This spec defines the authentication module for the multi-session compounding experiment.
The module provides user login, logout, and session validation functionality using
SHA-256 password hashing with salt and in-memory session storage with 30-minute expiry.

Future agents building task CRUD (Session 2) and rate limiting (Session 3) MUST read this
spec to understand the patterns established here before adding new features.

---

## Requirements

### AUTH-001-01: User Login
- The system MUST accept a username and plaintext password.
- The system MUST hash the password using SHA-256 with a per-user salt.
- On success, the system MUST return a session token (random hex string, 32 bytes).
- The session token MUST be stored in the session store with the username and expiry time.
- Session expiry MUST be set to 30 minutes from the time of login.
- If the username does not exist, login MUST return null.
- If the password is incorrect, login MUST return null.

### AUTH-001-02: User Logout
- The system MUST accept a session token.
- If the token exists in the session store, it MUST be removed.
- If the token does not exist, the operation MUST be a no-op (no error thrown).

### AUTH-001-03: Session Validation
- The system MUST accept a session token.
- If the token does not exist, isValidSession MUST return false.
- If the token exists but has expired (current time >= expiry), isValidSession MUST return false.
- If the token exists and has not expired, isValidSession MUST return true.
- Expired sessions MUST be lazily evicted on access.

### AUTH-001-04: User Store
- The module MUST export a `registerUser(username, password)` function for test setup.
- Passwords MUST be stored as `{ hash, salt }` objects, never as plaintext.
- Salt MUST be generated as 16 random bytes (hex-encoded, 32 chars).
- Hash MUST be computed as SHA-256(salt + password).

### AUTH-001-05: Hashing
- All hashing MUST use node:crypto `createHash('sha256')`.
- No external packages are permitted.

---

## Data Structures

### User Record
```js
{
  username: string,      // unique identifier
  hash: string,          // hex SHA-256(salt + password)
  salt: string           // hex 16-byte random salt
}
```

### Session Record
```js
{
  username: string,      // owner of the session
  token: string,         // hex 32-byte random session token
  expiresAt: number      // Date.now() + 30 * 60 * 1000
}
```

---

## Module Interface

```js
// auth.js — named exports (ESM)
export function registerUser(username, password)  // add user to user store
export function login(username, password)          // returns token string or null
export function logout(token)                      // removes session, returns void
export function isValidSession(token)              // returns boolean
export function _clearSessions()                   // TEST HELPER — resets both stores
```

---

## Patterns Established (read before building on top of this)

### Session Store Structure
The session store is a plain `Map<token, { username, token, expiresAt }>` held in module
scope. It is NOT persisted to disk. Future features (task CRUD, rate limiting) that need
to associate data with a session MUST call `isValidSession(token)` first to confirm the
session is live, then use the token as a lookup key into their OWN feature-level maps.
Do NOT import the session store Map directly — use the exported API.

### User Store Structure
The user store is a plain `Map<username, { username, hash, salt }>` held in module scope.
It is also NOT persisted. `registerUser` is the only write path.

### Test Helper Pattern: `_clearSessions()`
ALL tests that mutate state (login, logout, register) MUST call `_clearSessions()` in a
`beforeEach` equivalent block (or at the start of each test) to reset both the user store
and the session store to empty. This prevents test-order dependencies. The leading
underscore signals "test-only" — production callers MUST NOT call this function.

### Export Conventions
- The module uses **named ESM exports** (no default export).
- Import pattern: `import { login, logout, isValidSession, registerUser, _clearSessions } from './auth.js'`
- File extension `.js` MUST be included in all import statements (ESM + Node).
- All public functions are synchronous (no Promises, no async/await).

### Annotation Conventions
Every exported function carries:
```js
/**
 * @spec AUTH-001-XX
 * @implements AUTH-001-XX — <requirement text summary>
 * @evidence E0
 */
```
Evidence level E0 (declarative) is correct for all functions in this module since there
are no runtime measurements or test-captured results yet. After tests pass, annotators
may upgrade to E1.

---

## Out of Scope for AUTH-001
- Persistence (no SQLite, no file I/O)
- HTTP transport or middleware
- Role-based access control
- Token refresh
- Rate limiting (see future Session 3)
- Task CRUD (see future Session 2)

---

## Test Plan

Tests are in `auth.test.js` using `node:test` and `node:assert/strict`.

| Test | Requirement |
|------|-------------|
| login with valid credentials returns token string | AUTH-001-01 |
| login with unknown username returns null | AUTH-001-01 |
| login with wrong password returns null | AUTH-001-01 |
| login returns different tokens each call | AUTH-001-01 |
| logout removes session so isValidSession returns false | AUTH-001-02 |
| logout with unknown token does not throw | AUTH-001-02 |
| isValidSession returns true for fresh session | AUTH-001-03 |
| isValidSession returns false for expired session | AUTH-001-03 |
| isValidSession returns false for unknown token | AUTH-001-03 |
| registerUser stores user retrievable by login | AUTH-001-04 |
| password hash is not stored as plaintext | AUTH-001-04 |
| different users get different salts | AUTH-001-04 |
