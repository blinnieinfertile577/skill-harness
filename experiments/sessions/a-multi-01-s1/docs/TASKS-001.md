---
id: TASKS-001
title: "Task Management"
state: in_progress
kind: functional
required_evidence:
  implementation: E0
waivers:
  - kind: missing-verification
    target: TASKS-001
    owner: "agent"
    reason: "No VERIFIED_BY cross-reference claims exist yet. Beads issue tracking is not available in this session environment. Implementation is complete with comprehensive tests; formal verification linkage deferred until Beads is available."
    expires: "2026-07-01"
  - kind: missing-models
    target: TASKS-001
    owner: "agent"
    reason: "No structural models claims exist. This is a Session 2 in-memory CRUD module with no persistence layer; model-level evidence is out of scope."
    expires: "2026-07-01"
---

# TASKS-001: Task Management

## Overview

This spec defines the task management module for the multi-session compounding experiment.
The module provides task CRUD operations (create, list, get, update, delete) for authenticated
users, scoped per user so no user can see or modify another user's tasks.

All state is in-memory (no persistence). Session validation is delegated to the `auth.js`
module. Future agents building rate limiting (Session 3) MUST read this spec and AUTH-001.md
before adding new features.

---

## Requirements

### TASKS-001-01: Create Task
- The system MUST accept a valid session token and an object with `title` and optional `description`.
- The system MUST validate the session via `isValidSession(token)` before proceeding.
- If the token is invalid, createTask MUST throw an `Error` with message `'Unauthorized'`.
- If `title` is missing, empty string, or not a string, createTask MUST throw an `Error` with message `'Title is required'`.
- On success, the system MUST return a task object with fields: `id`, `title`, `description`, `status`, `createdAt`, `updatedAt`, `owner`.
- `id` MUST be cryptographically random hex (16 bytes = 32 hex chars) from `node:crypto`.
- `status` MUST default to `'todo'` on creation.
- `createdAt` and `updatedAt` MUST be set to `Date.now()` at creation time.
- `owner` MUST be the username retrieved from the session token.
- `description` MUST default to empty string if not provided.

### TASKS-001-02: List Tasks
- The system MUST accept a valid session token.
- If the token is invalid, getTasks MUST throw an `Error` with message `'Unauthorized'`.
- The system MUST return an array of task objects owned by the authenticated user.
- Tasks belonging to other users MUST NOT be included in the result.
- If the user has no tasks, the system MUST return an empty array.

### TASKS-001-03: Get Single Task
- The system MUST accept a valid session token and a task `id`.
- If the token is invalid, getTask MUST throw an `Error` with message `'Unauthorized'`.
- If the task does not exist OR exists but belongs to a different user, getTask MUST throw an `Error` with message `'Not found'`.
- This "not found or wrong owner → same error" behavior prevents leaking existence of other users' tasks.
- On success, the system MUST return the task object.

### TASKS-001-04: Update Task
- The system MUST accept a valid session token, a task `id`, and a partial update object `{ title?, description?, status? }`.
- If the token is invalid, updateTask MUST throw an `Error` with message `'Unauthorized'`.
- If the task does not exist or belongs to a different user, updateTask MUST throw an `Error` with message `'Not found'`.
- Allowed `status` values are `'todo'`, `'in_progress'`, and `'done'`.
- If `status` is provided but is not one of the allowed values, updateTask MUST throw an `Error` with message `'Invalid status'`.
- If `title` is provided as empty string, updateTask MUST throw an `Error` with message `'Title is required'`.
- The system MUST apply only the provided fields (partial update).
- `updatedAt` MUST be updated to `Date.now()` on every successful update.
- On success, the system MUST return the updated task object.

### TASKS-001-05: Delete Task
- The system MUST accept a valid session token and a task `id`.
- If the token is invalid, deleteTask MUST throw an `Error` with message `'Unauthorized'`.
- If the task does not exist or belongs to a different user, deleteTask MUST throw an `Error` with message `'Not found'`.
- On success, the system MUST remove the task and return `void`.

### TASKS-001-06: User Isolation
- All task operations MUST be scoped to the owner.
- User A MUST NOT be able to view, update, or delete user B's tasks, regardless of knowing the task `id`.

---

## Data Structures

### Task Object
```js
{
  id: string,          // hex 16-byte random identifier (32 chars)
  title: string,       // non-empty string
  description: string, // may be empty string
  status: string,      // 'todo' | 'in_progress' | 'done'
  createdAt: number,   // Date.now() timestamp at creation
  updatedAt: number,   // Date.now() timestamp at last update
  owner: string        // username from the session token
}
```

### Task Store
```
Map<id, task> — a single flat Map holding all tasks from all users.
Ownership filtering is applied in each exported function.
```

---

## Module Interface

```js
// tasks.js — named exports (ESM)
export function createTask(token, { title, description })    // returns task object
export function getTasks(token)                              // returns task[]
export function getTask(token, id)                          // returns task or throws 'Not found'
export function updateTask(token, id, { title?, description?, status? })  // returns task
export function deleteTask(token, id)                       // returns void
export function _clearTasks()                               // TEST HELPER — resets task store
```

---

## Patterns Established

### Session Validation
Every exported function calls `isValidSession(token)` from `./auth.js` first. If validation
fails, throw `new Error('Unauthorized')` immediately — do not proceed with any operation.

To retrieve the username from a valid token, call `getSessionUser(token)` from `./auth.js`.
This function was added to `auth.js` as a minimal extension to support this module.

### Ownership Enforcement
Tasks are stored in a single flat Map. Each function that operates on a specific task MUST:
1. Look up the task by `id`.
2. If the task does not exist OR `task.owner !== username`, throw `new Error('Not found')`.

This unified error ("Not found" for both not-existing and wrong-owner) prevents enumeration
attacks where an attacker could probe task IDs to discover other users' data.

### Test Helper Pattern: `_clearTasks()`
All tests that mutate state MUST call `_clearTasks()` AND `_clearSessions()` (from auth.js)
at the start of each test to prevent order dependencies. `_clearTasks()` resets only the
task store; auth state is reset separately via `_clearSessions()`.

### Import and Annotation Conventions
Follow the same patterns as `auth.js`:
- Named ESM exports, `.js` extension in imports.
- Every exported function carries `@spec TASKS-001`, `@implements`, and `@evidence E0`.
- All functions are synchronous.

---

## Out of Scope for TASKS-001
- Persistence (no SQLite, no file I/O)
- HTTP transport or middleware
- Task sharing between users
- Task priorities or due dates
- Rate limiting (see future Session 3)
- Pagination

---

## Test Plan

Tests are in `tasks.test.js` using `node:test` and `node:assert/strict`.

| Test | Requirement |
|------|-------------|
| createTask with valid token and title returns task object | TASKS-001-01 |
| createTask defaults status to 'todo' | TASKS-001-01 |
| createTask defaults description to empty string | TASKS-001-01 |
| createTask with invalid token throws Unauthorized | TASKS-001-01 |
| createTask with missing title throws Title is required | TASKS-001-01 |
| createTask with empty title throws Title is required | TASKS-001-01 |
| getTasks returns empty array when user has no tasks | TASKS-001-02 |
| getTasks returns only the authenticated user's tasks | TASKS-001-02 |
| getTasks does not return other users' tasks | TASKS-001-02 |
| getTasks with invalid token throws Unauthorized | TASKS-001-02 |
| getTask returns the correct task by id | TASKS-001-03 |
| getTask with invalid token throws Unauthorized | TASKS-001-03 |
| getTask with unknown id throws Not found | TASKS-001-03 |
| getTask with another user's task id throws Not found | TASKS-001-03 |
| updateTask updates title | TASKS-001-04 |
| updateTask updates description | TASKS-001-04 |
| updateTask updates status | TASKS-001-04 |
| updateTask with invalid status throws Invalid status | TASKS-001-04 |
| updateTask with empty title throws Title is required | TASKS-001-04 |
| updateTask is a partial update (untouched fields unchanged) | TASKS-001-04 |
| updateTask with invalid token throws Unauthorized | TASKS-001-04 |
| updateTask on another user's task throws Not found | TASKS-001-04 |
| deleteTask removes the task | TASKS-001-05 |
| deleteTask with invalid token throws Unauthorized | TASKS-001-05 |
| deleteTask on unknown id throws Not found | TASKS-001-05 |
| deleteTask on another user's task throws Not found | TASKS-001-05 |
| Cross-user isolation: user A tasks not visible to user B | TASKS-001-06 |
