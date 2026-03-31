# auth-module

A minimal, dependency-free authentication module for Node.js (ESM).

Provides three public operations:

| Function | Description |
|---|---|
| `register(username, password)` | Create a credential record (password hashed before storage). |
| `login(username, password)` | Verify credentials and return a session token. |
| `logout(token)` | Invalidate a session token. |
| `isValidSession(token)` | Return `true` if the token exists and has not expired. |

## Requirements

- Node.js >= 22
- No external dependencies — uses `node:crypto` and `node:test` only.

## Installation

```
npm install   # nothing to install; no external deps
```

## Auth API

| Function | Description |
|---|---|
| `register(username, password)` | Create a credential record (password hashed before storage). |
| `login(username, password)` | Verify credentials and return a session token. |
| `logout(token)` | Invalidate a session token. |
| `isValidSession(token)` | Return `true` if the token exists and has not expired. |
| `getUsernameFromToken(token)` | Resolve the username for a valid token, or throw if invalid/expired. |

### Usage

```js
import { register, login, logout, isValidSession } from './src/auth.js';

// Create a user (password is hashed; never stored in plaintext)
register('alice', 'hunter2');

// Authenticate → receive a session token
const token = login('alice', 'hunter2');

// Validate the session (resets the inactivity timer on success)
console.log(isValidSession(token)); // true

// Destroy the session
logout(token);
console.log(isValidSession(token)); // false
```

## Tasks API

Tasks are scoped to an authenticated user. Every operation requires a valid session token. The token is used to look up the owning username; cross-user access is rejected with a `"not found"` error (no information leakage about other users' task ids).

| Function | Description |
|---|---|
| `createTask(token, { title, description? })` | Create a new task owned by the session user. Returns the task object. |
| `getTasks(token)` | Return all tasks owned by the session user (array, may be empty). |
| `getTask(token, id)` | Return a single task by id. Throws if not found or not owned by the caller. |
| `updateTask(token, id, patch)` | Update `title`, `description`, and/or `status`. Returns the updated task. |
| `deleteTask(token, id)` | Delete a task. Returns `undefined`. Throws if not found or not owned. |

### Task object shape

```js
{
  id:          string,  // 32-char hex, cryptographically random
  title:       string,  // non-empty, whitespace-trimmed
  description: string,  // defaults to ''
  status:      'todo' | 'in_progress' | 'done',
  createdAt:   number,  // epoch ms
  updatedAt:   number,  // epoch ms, refreshed on every successful updateTask call
  owner:       string,  // username resolved from the session token at create time
}
```

### Valid status values

`VALID_STATUSES` (exported constant): `['todo', 'in_progress', 'done']`.

Passing any other value to `createTask` (default is `'todo'`) or to `updateTask` causes a `TypeError`.

### Usage

```js
import { register, login } from './src/auth.js';
import { createTask, getTasks, getTask, updateTask, deleteTask } from './src/tasks.js';

register('alice', 'hunter2');
const token = login('alice', 'hunter2');

// Create
const task = createTask(token, { title: 'Write docs', description: 'Update README' });
console.log(task.id, task.status); // <hex id>  todo

// List all
const list = getTasks(token);

// Read one
const fetched = getTask(token, task.id);

// Update
const updated = updateTask(token, task.id, { status: 'in_progress' });

// Delete
deleteTask(token, task.id);
```

### Error behaviour

- All operations throw `Error('Invalid or expired session token')` when given an invalid or expired token.
- `getTask`, `updateTask`, and `deleteTask` throw `Error('Task "<id>" not found')` when the id does not exist or is owned by a different user.
- `createTask` and `updateTask` throw `TypeError` on invalid field values (empty title, wrong status, etc.).

## Security model

### Password storage

Passwords are **never stored in plaintext**. On `register`, 16 cryptographically random bytes are generated via `crypto.randomBytes`. The stored record is:

```
salt   = randomBytes(16).toString('hex')   // 32-char hex, unique per user
hash   = SHA-256(salt + password)          // hex digest
stored = { salt, hash }
```

On `login`, the candidate digest is recomputed from the stored salt and compared to the stored hash. Because each user has a unique salt, two users with the same password produce different stored hashes.

### Session tokens

Tokens are 32 cryptographically random bytes (`randomBytes(32)`) encoded as a 64-character hex string. They carry no information about the user or the time of creation.

### Inactivity expiry

Sessions expire after **30 minutes of inactivity** (`SESSION_TIMEOUT_MS = 1 800 000 ms`). The timer uses a **sliding window**: every successful call to `isValidSession` resets the inactivity clock. Expired sessions are purged lazily on every public API call.

### Error messages

`login` returns the same error message (`"Invalid username or password"`) whether the username does not exist or the password is wrong. This prevents user-enumeration attacks.

## Running tests

```
npm test
```

Expected output: **74 tests, 0 failures**.

The test suite covers:

**auth.test.js (29 tests)**

- `register` — validation, duplicate detection, type checks (7 tests)
- `login` — happy path, token uniqueness, wrong credentials, error-message parity, no plaintext leakage (6 tests)
- `logout` — invalidation, idempotency, targeted invalidation (4 tests)
- `isValidSession` — fresh session, unknown token, post-logout, expiry boundary, sliding window (7 tests)
- `SESSION_TIMEOUT_MS` constant value (1 test)
- Multi-user isolation (2 tests)
- Password hashing — per-user salt, repeated failure handling (2 tests)

**tasks.test.js (45 tests)**

- `VALID_STATUSES` constant shape and immutability (2 tests)
- `createTask` — shape, description, title trimming, unique ids, auth failure, validation, snapshot isolation (10 tests)
- `getTasks` — empty list, multi-task, cross-user filtering, auth failure, snapshot isolation (5 tests)
- `getTask` — happy path, auth failure, not found, cross-user access, snapshot isolation (5 tests)
- `updateTask` — title/description/status updates, multi-field, partial patch, updatedAt refresh, createdAt unchanged, auth failure, not found, cross-user, invalid status/title/description (15 tests)
- `deleteTask` — removes from getTask/getTasks, returns void, auth failure, not found, cross-user (6 tests)
- Cross-user isolation — independent tasks, isolated delete (2 tests)

## File structure

```
src/
  auth.js          Auth implementation
  tasks.js         Task management store
test/
  auth.test.js     node:test suite (29 tests)
  tasks.test.js    node:test suite (45 tasks tests)
package.json
README.md
```

## Implementation decisions

1. **In-memory only.** Neither module touches the filesystem or any database. Persistence across process restarts is the caller's responsibility. This keeps both modules focused and testable without I/O.

2. **SHA-256 + random salt.** SHA-256 is available natively via `node:crypto`. A production system would prefer bcrypt/scrypt/argon2, but those require external packages which are out of scope here.

3. **Sliding-window expiry.** `isValidSession` and `getUsernameFromToken` both refresh `lastActivity` on each successful call. This keeps active users logged in without a separate heartbeat mechanism.

4. **Lazy purge.** There is no background timer. Expired sessions are swept on every public call, which is sufficient for a single-process module and avoids the complexity of timers that could prevent the process from exiting cleanly.

5. **Test helpers exported under `_` prefix.** `_reset()` and `_injectSession()` (auth) and `_resetTasks()` (tasks) are exported so tests can perform state isolation without coupling to module internals.

6. **Ownership enforcement on every mutation.** `getTask`, `updateTask`, and `deleteTask` all resolve the username from the token first and then verify ownership. The error message for cross-user access is identical to "not found" to avoid leaking information about other users' task ids.

7. **Snapshot returns.** All public task functions return shallow copies of the internal task objects. Callers cannot mutate store state via a returned reference.
