/**
 * tasks.js — Task management store
 *
 * Provides CRUD operations for tasks that are scoped to an authenticated user.
 * Every operation requires a valid session token; the username is resolved from
 * the token via the auth module's getUsernameFromToken helper.
 *
 * Design decisions:
 * - All state is held in a single in-memory Map keyed by task id.
 * - Task IDs are 16-byte cryptographically random hex strings (32 chars).
 * - Ownership is enforced on every read/update/delete; a user cannot access
 *   another user's tasks even if they somehow know the id.
 * - Status is restricted to the three canonical values: 'todo', 'in_progress',
 *   'done'. Any other value causes an immediate TypeError.
 * - updatedAt is refreshed on every successful updateTask call.
 * - ESM-only; uses node:crypto exclusively.
 */

import { randomBytes } from 'node:crypto';
import { getUsernameFromToken } from './auth.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed status values for a task. */
export const VALID_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Task store: id → { id, title, description, status, createdAt, updatedAt, owner }
 * @type {Map<string, { id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }>}
 */
const tasks = new Map();

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random 32-character hex task ID.
 * @returns {string}
 */
function generateId() {
  return randomBytes(16).toString('hex');
}

/**
 * Retrieve a task that must be owned by the given username.
 * Throws a descriptive Error if the task does not exist or is owned by
 * a different user.
 *
 * @param {string} id
 * @param {string} owner
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 */
function requireOwnedTask(id, owner) {
  const task = tasks.get(id);
  if (!task) {
    throw new Error(`Task "${id}" not found`);
  }
  if (task.owner !== owner) {
    // Return the same error to avoid leaking the existence of other users' tasks.
    throw new Error(`Task "${id}" not found`);
  }
  return task;
}

/**
 * Return a shallow copy of a task object so callers cannot mutate store state.
 * @param {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }} task
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 */
function snapshot(task) {
  return { ...task };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new task owned by the authenticated user.
 *
 * @param {string} token  Valid session token.
 * @param {{ title: string, description?: string }} options
 * @returns {{ id: string, title: string, description: string, status: 'todo', createdAt: number, updatedAt: number, owner: string }}
 * @throws {Error} If the token is invalid/expired.
 * @throws {TypeError} If title is missing or not a non-empty string.
 */
export function createTask(token, { title, description = '' } = {}) {
  const owner = getUsernameFromToken(token); // throws on bad token

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new TypeError('title must be a non-empty string');
  }

  const now = Date.now();
  const task = {
    id: generateId(),
    title: title.trim(),
    description: typeof description === 'string' ? description : '',
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    owner,
  };

  tasks.set(task.id, task);
  return snapshot(task);
}

/**
 * Return all tasks owned by the authenticated user.
 *
 * @param {string} token  Valid session token.
 * @returns {Array<{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }>}
 * @throws {Error} If the token is invalid/expired.
 */
export function getTasks(token) {
  const owner = getUsernameFromToken(token);

  const result = [];
  for (const task of tasks.values()) {
    if (task.owner === owner) {
      result.push(snapshot(task));
    }
  }
  return result;
}

/**
 * Return a single task by id, scoped to the authenticated user.
 *
 * @param {string} token  Valid session token.
 * @param {string} id     Task id.
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 * @throws {Error} If the token is invalid/expired, or the task is not found / not owned.
 */
export function getTask(token, id) {
  const owner = getUsernameFromToken(token);
  return snapshot(requireOwnedTask(id, owner));
}

/**
 * Update a task's title, description, and/or status.
 *
 * Only the fields present in the patch object are changed; omitted fields
 * retain their current values.
 *
 * @param {string} token  Valid session token.
 * @param {string} id     Task id.
 * @param {{ title?: string, description?: string, status?: string }} patch
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 * @throws {Error}     If the token is invalid/expired, or the task is not found / not owned.
 * @throws {TypeError} If a supplied field fails validation.
 */
export function updateTask(token, id, patch = {}) {
  const owner = getUsernameFromToken(token);
  const task = requireOwnedTask(id, owner);

  if ('title' in patch) {
    if (typeof patch.title !== 'string' || patch.title.trim().length === 0) {
      throw new TypeError('title must be a non-empty string');
    }
    task.title = patch.title.trim();
  }

  if ('description' in patch) {
    if (typeof patch.description !== 'string') {
      throw new TypeError('description must be a string');
    }
    task.description = patch.description;
  }

  if ('status' in patch) {
    if (!VALID_STATUSES.includes(patch.status)) {
      throw new TypeError(
        `status must be one of: ${VALID_STATUSES.join(', ')}; got "${patch.status}"`
      );
    }
    task.status = patch.status;
  }

  task.updatedAt = Date.now();
  return snapshot(task);
}

/**
 * Delete a task.
 *
 * @param {string} token  Valid session token.
 * @param {string} id     Task id.
 * @returns {void}
 * @throws {Error} If the token is invalid/expired, or the task is not found / not owned.
 */
export function deleteTask(token, id) {
  const owner = getUsernameFromToken(token);
  requireOwnedTask(id, owner); // throws if not found or not owned
  tasks.delete(id);
}

// ---------------------------------------------------------------------------
// Test-only helpers (exported for white-box testing)
// ---------------------------------------------------------------------------

/**
 * Reset all task state. Intended only for test isolation.
 */
export function _resetTasks() {
  tasks.clear();
}
