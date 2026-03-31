/**
 * tasks.js — Task management module
 *
 * Provides per-user task CRUD: create, list, get, update, delete.
 * All state is in-memory (no persistence). Session validation is
 * delegated to auth.js. See docs/TASKS-001.md for full spec.
 *
 * @spec TASKS-001
 * @implements createTask,getTasks,getTask,updateTask,deleteTask
 * @evidence E0
 */

import { randomBytes } from 'node:crypto';
import { isValidSession, getSessionUser } from './auth.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid task status values. */
const VALID_STATUSES = new Set(['todo', 'in_progress', 'done']);

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Task store: Map<id, { id, title, description, status, createdAt, updatedAt, owner }>
 * Never access this directly from outside — use exported functions.
 *
 * @spec TASKS-001
 * @implements taskStore
 * @evidence E0
 */
const _taskStore = new Map();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate a session token and return the username.
 * Throws Error('Unauthorized') if the session is invalid.
 *
 * @param {string} token
 * @returns {string} username
 */
function _requireAuth(token) {
  if (!isValidSession(token)) {
    throw new Error('Unauthorized');
  }
  return getSessionUser(token);
}

/**
 * Look up a task by id and verify ownership.
 * Throws Error('Not found') if the task does not exist or belongs to a
 * different user — intentionally unified to prevent existence leakage.
 *
 * @param {string} id
 * @param {string} username
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 */
function _requireOwnedTask(id, username) {
  const task = _taskStore.get(id);
  if (!task || task.owner !== username) {
    throw new Error('Not found');
  }
  return task;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Create a new task owned by the authenticated user.
 *
 * TASKS-001-01: validates session, requires non-empty title, generates a
 * cryptographically random id (16 bytes hex), defaults status to 'todo'.
 *
 * @param {string} token — valid session token
 * @param {{ title: string, description?: string }} options
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 *
 * @spec TASKS-001
 * @implements createTask
 * @evidence E0
 */
export function createTask(token, { title, description = '' } = {}) {
  const owner = _requireAuth(token);

  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error('Title is required');
  }

  const id = randomBytes(16).toString('hex');
  const now = Date.now();
  const task = {
    id,
    title,
    description,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    owner,
  };

  _taskStore.set(id, task);
  return { ...task };
}

/**
 * Return all tasks belonging to the authenticated user.
 *
 * TASKS-001-02: filters to only tasks whose owner matches the session username.
 * Returns an empty array if the user has no tasks.
 *
 * @param {string} token — valid session token
 * @returns {Array<{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }>}
 *
 * @spec TASKS-001
 * @implements getTasks
 * @evidence E0
 */
export function getTasks(token) {
  const owner = _requireAuth(token);
  const results = [];
  for (const task of _taskStore.values()) {
    if (task.owner === owner) {
      results.push({ ...task });
    }
  }
  return results;
}

/**
 * Return a single task by id for the authenticated user.
 *
 * TASKS-001-03: throws 'Not found' for both non-existent and wrong-owner
 * tasks to prevent existence leakage.
 *
 * @param {string} token — valid session token
 * @param {string} id — task id
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 *
 * @spec TASKS-001
 * @implements getTask
 * @evidence E0
 */
export function getTask(token, id) {
  const owner = _requireAuth(token);
  const task = _requireOwnedTask(id, owner);
  return { ...task };
}

/**
 * Update one or more fields of an existing task owned by the authenticated user.
 *
 * TASKS-001-04: partial update — only provided fields are changed; untouched
 * fields remain as-is. updatedAt is always refreshed on success.
 * Allowed status values: 'todo', 'in_progress', 'done'.
 *
 * @param {string} token — valid session token
 * @param {string} id — task id
 * @param {{ title?: string, description?: string, status?: string }} updates
 * @returns {{ id: string, title: string, description: string, status: string, createdAt: number, updatedAt: number, owner: string }}
 *
 * @spec TASKS-001
 * @implements updateTask
 * @evidence E0
 */
export function updateTask(token, id, updates = {}) {
  const owner = _requireAuth(token);
  const task = _requireOwnedTask(id, owner);

  const { title, description, status } = updates;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error('Title is required');
    }
    task.title = title;
  }

  if (description !== undefined) {
    task.description = description;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error('Invalid status');
    }
    task.status = status;
  }

  task.updatedAt = Date.now();
  return { ...task };
}

/**
 * Delete a task owned by the authenticated user.
 *
 * TASKS-001-05: throws 'Not found' for both non-existent and wrong-owner
 * tasks to prevent existence leakage.
 *
 * @param {string} token — valid session token
 * @param {string} id — task id
 * @returns {void}
 *
 * @spec TASKS-001
 * @implements deleteTask
 * @evidence E0
 */
export function deleteTask(token, id) {
  const owner = _requireAuth(token);
  _requireOwnedTask(id, owner); // throws if not found or wrong owner
  _taskStore.delete(id);
}

/**
 * TEST HELPER — Reset the task store to empty.
 *
 * Call this (along with auth's _clearSessions()) at the start of every test
 * that mutates state to prevent test-order dependencies.
 * MUST NOT be called in production code.
 *
 * @returns {void}
 *
 * @spec TASKS-001
 * @implements testHelper
 * @evidence E0
 */
export function _clearTasks() {
  _taskStore.clear();
}
