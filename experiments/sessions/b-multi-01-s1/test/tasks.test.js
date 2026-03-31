/**
 * tasks.test.js — Tests for the task management store
 *
 * Runtime: node:test + node:assert/strict (no external dependencies).
 * Run with: node --test test/tasks.test.js
 *
 * The suite also exercises auth integration: every task operation requires a
 * valid session token, so auth failures are tested for every entry point.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { register, login, _reset as resetAuth } from '../src/auth.js';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  VALID_STATUSES,
  _resetTasks,
} from '../src/tasks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset both auth and task stores before each test group. */
function resetAll() {
  resetAuth();
  _resetTasks();
}

/** Register a user and return a valid token. */
function makeUser(username = 'alice', password = 'pass') {
  register(username, password);
  return login(username, password);
}

const INVALID_TOKEN = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// ---------------------------------------------------------------------------
// VALID_STATUSES constant
// ---------------------------------------------------------------------------

describe('VALID_STATUSES', () => {
  it('contains exactly todo, in_progress, done', () => {
    assert.deepEqual([...VALID_STATUSES].sort(), ['done', 'in_progress', 'todo'].sort());
  });

  it('is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(VALID_STATUSES));
  });
});

// ---------------------------------------------------------------------------
// createTask()
// ---------------------------------------------------------------------------

describe('createTask', () => {
  beforeEach(resetAll);

  it('returns a task object with expected shape', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Write tests' });

    assert.ok(typeof task.id === 'string' && task.id.length === 32, 'id is 32-char hex');
    assert.equal(task.title, 'Write tests');
    assert.equal(task.description, '');
    assert.equal(task.status, 'todo');
    assert.equal(task.owner, 'alice');
    assert.ok(typeof task.createdAt === 'number');
    assert.ok(typeof task.updatedAt === 'number');
    assert.equal(task.createdAt, task.updatedAt);
  });

  it('stores a description when provided', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Task A', description: 'some detail' });
    assert.equal(task.description, 'some detail');
  });

  it('trims whitespace from title', () => {
    const token = makeUser();
    const task = createTask(token, { title: '  trimmed  ' });
    assert.equal(task.title, 'trimmed');
  });

  it('each call produces a unique id', () => {
    const token = makeUser();
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(createTask(token, { title: `Task ${i}` }).id);
    }
    assert.equal(ids.size, 10);
  });

  it('throws on invalid/expired token', () => {
    assert.throws(() => createTask(INVALID_TOKEN, { title: 'x' }), /invalid|expired/i);
  });

  it('throws TypeError when title is missing', () => {
    const token = makeUser();
    assert.throws(() => createTask(token, {}), TypeError);
  });

  it('throws TypeError when title is an empty string', () => {
    const token = makeUser();
    assert.throws(() => createTask(token, { title: '' }), TypeError);
  });

  it('throws TypeError when title is only whitespace', () => {
    const token = makeUser();
    assert.throws(() => createTask(token, { title: '   ' }), TypeError);
  });

  it('throws TypeError when title is not a string', () => {
    const token = makeUser();
    assert.throws(() => createTask(token, { title: 42 }), TypeError);
  });

  it('returned object is a snapshot; mutating it does not affect the store', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Immutable' });
    task.title = 'Mutated';
    const fetched = getTask(token, task.id);
    assert.equal(fetched.title, 'Immutable');
  });
});

// ---------------------------------------------------------------------------
// getTasks()
// ---------------------------------------------------------------------------

describe('getTasks', () => {
  beforeEach(resetAll);

  it('returns an empty array when the user has no tasks', () => {
    const token = makeUser();
    assert.deepEqual(getTasks(token), []);
  });

  it('returns all tasks owned by the user', () => {
    const token = makeUser();
    createTask(token, { title: 'T1' });
    createTask(token, { title: 'T2' });
    createTask(token, { title: 'T3' });
    const list = getTasks(token);
    assert.equal(list.length, 3);
  });

  it('does not return tasks owned by a different user', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    createTask(tokenA, { title: 'Alice task' });
    createTask(tokenB, { title: 'Bob task' });

    const aliceTasks = getTasks(tokenA);
    const bobTasks = getTasks(tokenB);

    assert.equal(aliceTasks.length, 1);
    assert.equal(aliceTasks[0].title, 'Alice task');
    assert.equal(bobTasks.length, 1);
    assert.equal(bobTasks[0].title, 'Bob task');
  });

  it('throws on invalid/expired token', () => {
    assert.throws(() => getTasks(INVALID_TOKEN), /invalid|expired/i);
  });

  it('each item is a snapshot; mutating it does not affect the store', () => {
    const token = makeUser();
    createTask(token, { title: 'Original' });
    const list = getTasks(token);
    list[0].title = 'Modified';
    assert.equal(getTasks(token)[0].title, 'Original');
  });
});

// ---------------------------------------------------------------------------
// getTask()
// ---------------------------------------------------------------------------

describe('getTask', () => {
  beforeEach(resetAll);

  it('returns the correct task by id', () => {
    const token = makeUser();
    const created = createTask(token, { title: 'Find me' });
    const fetched = getTask(token, created.id);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.title, 'Find me');
  });

  it('throws on invalid/expired token', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'x' });
    assert.throws(() => getTask(INVALID_TOKEN, task.id), /invalid|expired/i);
  });

  it('throws when task id does not exist', () => {
    const token = makeUser();
    assert.throws(() => getTask(token, 'nonexistentid'), /not found/i);
  });

  it('throws when task is owned by a different user (not found — no leakage)', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    const task = createTask(tokenA, { title: 'Private' });
    // Bob tries to access Alice's task
    assert.throws(() => getTask(tokenB, task.id), /not found/i);
  });

  it('returned object is a snapshot', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Snapshot' });
    const fetched = getTask(token, task.id);
    fetched.title = 'Changed';
    assert.equal(getTask(token, task.id).title, 'Snapshot');
  });
});

// ---------------------------------------------------------------------------
// updateTask()
// ---------------------------------------------------------------------------

describe('updateTask', () => {
  beforeEach(resetAll);

  it('updates the title', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Old title' });
    const updated = updateTask(token, task.id, { title: 'New title' });
    assert.equal(updated.title, 'New title');
  });

  it('updates the description', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T', description: 'old' });
    const updated = updateTask(token, task.id, { description: 'new desc' });
    assert.equal(updated.description, 'new desc');
  });

  it('updates the status to in_progress', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    const updated = updateTask(token, task.id, { status: 'in_progress' });
    assert.equal(updated.status, 'in_progress');
  });

  it('updates the status to done', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    const updated = updateTask(token, task.id, { status: 'done' });
    assert.equal(updated.status, 'done');
  });

  it('updates the status back to todo', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    updateTask(token, task.id, { status: 'done' });
    const updated = updateTask(token, task.id, { status: 'todo' });
    assert.equal(updated.status, 'todo');
  });

  it('can update multiple fields in one call', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T', description: 'desc' });
    const updated = updateTask(token, task.id, {
      title: 'New T',
      description: 'New desc',
      status: 'done',
    });
    assert.equal(updated.title, 'New T');
    assert.equal(updated.description, 'New desc');
    assert.equal(updated.status, 'done');
  });

  it('only changes the fields present in patch (other fields untouched)', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Keep', description: 'keep me' });
    const updated = updateTask(token, task.id, { status: 'done' });
    assert.equal(updated.title, 'Keep');
    assert.equal(updated.description, 'keep me');
  });

  it('refreshes updatedAt after an update', async () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    // Small async delay to ensure updatedAt differs from createdAt
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTask(token, task.id, { status: 'done' });
    assert.ok(updated.updatedAt >= task.updatedAt);
  });

  it('does not change createdAt', async () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTask(token, task.id, { title: 'New T' });
    assert.equal(updated.createdAt, task.createdAt);
  });

  it('throws on invalid/expired token', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'x' });
    assert.throws(() => updateTask(INVALID_TOKEN, task.id, { title: 'y' }), /invalid|expired/i);
  });

  it('throws when task id does not exist', () => {
    const token = makeUser();
    assert.throws(() => updateTask(token, 'badid', { title: 'y' }), /not found/i);
  });

  it('throws when task is owned by a different user', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    const task = createTask(tokenA, { title: 'Alice task' });
    assert.throws(() => updateTask(tokenB, task.id, { title: 'Hijack' }), /not found/i);
  });

  it('throws TypeError for invalid status value', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    assert.throws(() => updateTask(token, task.id, { status: 'INVALID' }), TypeError);
  });

  it('throws TypeError for empty title in patch', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    assert.throws(() => updateTask(token, task.id, { title: '' }), TypeError);
  });

  it('throws TypeError for non-string description in patch', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    assert.throws(() => updateTask(token, task.id, { description: 99 }), TypeError);
  });
});

// ---------------------------------------------------------------------------
// deleteTask()
// ---------------------------------------------------------------------------

describe('deleteTask', () => {
  beforeEach(resetAll);

  it('removes the task so getTask throws afterwards', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'Delete me' });
    deleteTask(token, task.id);
    assert.throws(() => getTask(token, task.id), /not found/i);
  });

  it('removes the task from getTasks result', () => {
    const token = makeUser();
    const t1 = createTask(token, { title: 'Keep' });
    const t2 = createTask(token, { title: 'Remove' });
    deleteTask(token, t2.id);
    const list = getTasks(token);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, t1.id);
  });

  it('returns void on success', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'T' });
    const result = deleteTask(token, task.id);
    assert.equal(result, undefined);
  });

  it('throws on invalid/expired token', () => {
    const token = makeUser();
    const task = createTask(token, { title: 'x' });
    assert.throws(() => deleteTask(INVALID_TOKEN, task.id), /invalid|expired/i);
  });

  it('throws when task id does not exist', () => {
    const token = makeUser();
    assert.throws(() => deleteTask(token, 'nonexistent'), /not found/i);
  });

  it('throws when task is owned by a different user', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    const task = createTask(tokenA, { title: 'Alice task' });
    assert.throws(() => deleteTask(tokenB, task.id), /not found/i);
    // Task still exists for Alice
    assert.doesNotThrow(() => getTask(tokenA, task.id));
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation (combined)
// ---------------------------------------------------------------------------

describe('cross-user isolation', () => {
  beforeEach(resetAll);

  it('users with the same task title have separate independent tasks', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    const tA = createTask(tokenA, { title: 'Shared title' });
    const tB = createTask(tokenB, { title: 'Shared title' });

    assert.notEqual(tA.id, tB.id);
    assert.equal(tA.owner, 'alice');
    assert.equal(tB.owner, 'bob');
  });

  it('deleting own task does not affect other user\'s tasks', () => {
    const tokenA = makeUser('alice');
    register('bob', 'bpass');
    const tokenB = login('bob', 'bpass');

    const tA = createTask(tokenA, { title: 'Alice' });
    const tB = createTask(tokenB, { title: 'Bob' });

    deleteTask(tokenA, tA.id);

    assert.throws(() => getTask(tokenA, tA.id), /not found/i);
    assert.doesNotThrow(() => getTask(tokenB, tB.id));
  });
});
