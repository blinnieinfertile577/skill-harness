/**
 * tasks.test.js — Tests for TASKS-001 task management module
 *
 * Uses node:test and node:assert/strict.
 * Each test calls _clearTasks() + _clearSessions() at the start to reset
 * all state — see docs/TASKS-001.md "Test Helper Pattern" section.
 *
 * @spec TASKS-001
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  _clearTasks,
} from './tasks.js';
import {
  registerUser,
  login,
  _clearSessions,
} from './auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reset() {
  _clearTasks();
  _clearSessions();
}

function setupUser(username = 'alice', password = 'pw') {
  registerUser(username, password);
  return login(username, password);
}

// ---------------------------------------------------------------------------
// createTask — TASKS-001-01
// ---------------------------------------------------------------------------

test('createTask: happy path returns a task object with expected shape', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Buy milk' });

  assert.ok(typeof task.id === 'string', 'id should be a string');
  assert.ok(/^[0-9a-f]{32}$/.test(task.id), 'id should be 32 hex chars');
  assert.equal(task.title, 'Buy milk');
  assert.equal(task.description, '');
  assert.equal(task.status, 'todo');
  assert.ok(typeof task.createdAt === 'number');
  assert.ok(typeof task.updatedAt === 'number');
  assert.equal(task.owner, 'alice');
});

test('createTask: description is stored when provided', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Buy milk', description: 'Whole milk' });
  assert.equal(task.description, 'Whole milk');
});

test('createTask: default description is empty string', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'No desc' });
  assert.equal(task.description, '');
});

test('createTask: default status is todo', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  assert.equal(task.status, 'todo');
});

test('createTask: each task gets a unique id', () => {
  reset();
  const token = setupUser('alice');
  const t1 = createTask(token, { title: 'Task 1' });
  const t2 = createTask(token, { title: 'Task 2' });
  assert.notEqual(t1.id, t2.id);
});

test('createTask: invalid token throws Unauthorized', () => {
  reset();
  assert.throws(
    () => createTask('not-a-valid-token', { title: 'Task' }),
    { message: 'Unauthorized' },
  );
});

test('createTask: missing title throws Title is required', () => {
  reset();
  const token = setupUser('alice');
  assert.throws(
    () => createTask(token, {}),
    { message: 'Title is required' },
  );
});

test('createTask: empty string title throws Title is required', () => {
  reset();
  const token = setupUser('alice');
  assert.throws(
    () => createTask(token, { title: '' }),
    { message: 'Title is required' },
  );
});

test('createTask: whitespace-only title throws Title is required', () => {
  reset();
  const token = setupUser('alice');
  assert.throws(
    () => createTask(token, { title: '   ' }),
    { message: 'Title is required' },
  );
});

// ---------------------------------------------------------------------------
// getTasks — TASKS-001-02
// ---------------------------------------------------------------------------

test('getTasks: returns empty array when user has no tasks', () => {
  reset();
  const token = setupUser('alice');
  const tasks = getTasks(token);
  assert.deepEqual(tasks, []);
});

test('getTasks: returns all tasks owned by the authenticated user', () => {
  reset();
  const token = setupUser('alice');
  createTask(token, { title: 'Task A' });
  createTask(token, { title: 'Task B' });
  const tasks = getTasks(token);
  assert.equal(tasks.length, 2);
});

test('getTasks: does not return tasks belonging to another user', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');

  createTask(aliceToken, { title: "Alice's task" });
  createTask(bobToken, { title: "Bob's task" });

  const aliceTasks = getTasks(aliceToken);
  assert.equal(aliceTasks.length, 1);
  assert.equal(aliceTasks[0].owner, 'alice');

  const bobTasks = getTasks(bobToken);
  assert.equal(bobTasks.length, 1);
  assert.equal(bobTasks[0].owner, 'bob');
});

test('getTasks: invalid token throws Unauthorized', () => {
  reset();
  assert.throws(
    () => getTasks('bad-token'),
    { message: 'Unauthorized' },
  );
});

// ---------------------------------------------------------------------------
// getTask — TASKS-001-03
// ---------------------------------------------------------------------------

test('getTask: happy path returns the correct task', () => {
  reset();
  const token = setupUser('alice');
  const created = createTask(token, { title: 'Find me' });
  const fetched = getTask(token, created.id);
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.title, 'Find me');
});

test('getTask: invalid token throws Unauthorized', () => {
  reset();
  assert.throws(
    () => getTask('bad-token', 'some-id'),
    { message: 'Unauthorized' },
  );
});

test('getTask: unknown id throws Not found', () => {
  reset();
  const token = setupUser('alice');
  assert.throws(
    () => getTask(token, 'nonexistent-id'),
    { message: 'Not found' },
  );
});

test('getTask: another user\'s task id throws Not found (no existence leakage)', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');

  const bobTask = createTask(bobToken, { title: "Bob's secret" });

  // Alice knows Bob's task id but should NOT be able to retrieve it
  assert.throws(
    () => getTask(aliceToken, bobTask.id),
    { message: 'Not found' },
  );
});

// ---------------------------------------------------------------------------
// updateTask — TASKS-001-04
// ---------------------------------------------------------------------------

test('updateTask: updates title', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Old title' });
  const updated = updateTask(token, task.id, { title: 'New title' });
  assert.equal(updated.title, 'New title');
});

test('updateTask: updates description', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task', description: 'Old desc' });
  const updated = updateTask(token, task.id, { description: 'New desc' });
  assert.equal(updated.description, 'New desc');
});

test('updateTask: updates status to in_progress', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  const updated = updateTask(token, task.id, { status: 'in_progress' });
  assert.equal(updated.status, 'in_progress');
});

test('updateTask: updates status to done', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  const updated = updateTask(token, task.id, { status: 'done' });
  assert.equal(updated.status, 'done');
});

test('updateTask: updates status back to todo', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  updateTask(token, task.id, { status: 'done' });
  const updated = updateTask(token, task.id, { status: 'todo' });
  assert.equal(updated.status, 'todo');
});

test('updateTask: invalid status throws Invalid status', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  assert.throws(
    () => updateTask(token, task.id, { status: 'archived' }),
    { message: 'Invalid status' },
  );
});

test('updateTask: empty title throws Title is required', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  assert.throws(
    () => updateTask(token, task.id, { title: '' }),
    { message: 'Title is required' },
  );
});

test('updateTask: partial update leaves untouched fields unchanged', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Title', description: 'Desc' });
  const updated = updateTask(token, task.id, { title: 'New title' });
  assert.equal(updated.description, 'Desc', 'description should be unchanged');
  assert.equal(updated.status, 'todo', 'status should be unchanged');
});

test('updateTask: updatedAt is refreshed after update', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  const before = task.updatedAt;

  // Advance time slightly to ensure updatedAt changes
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 1000;
    const updated = updateTask(token, task.id, { title: 'Updated' });
    assert.ok(updated.updatedAt > before, 'updatedAt should be later than creation time');
  } finally {
    Date.now = realNow;
  }
});

test('updateTask: invalid token throws Unauthorized', () => {
  reset();
  assert.throws(
    () => updateTask('bad-token', 'some-id', { title: 'X' }),
    { message: 'Unauthorized' },
  );
});

test('updateTask: another user\'s task throws Not found', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');
  const bobTask = createTask(bobToken, { title: "Bob's task" });

  assert.throws(
    () => updateTask(aliceToken, bobTask.id, { title: 'Hijacked' }),
    { message: 'Not found' },
  );
});

// ---------------------------------------------------------------------------
// deleteTask — TASKS-001-05
// ---------------------------------------------------------------------------

test('deleteTask: removes the task so getTask throws Not found afterwards', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'To delete' });
  deleteTask(token, task.id);
  assert.throws(
    () => getTask(token, task.id),
    { message: 'Not found' },
  );
});

test('deleteTask: returns void (undefined)', () => {
  reset();
  const token = setupUser('alice');
  const task = createTask(token, { title: 'Task' });
  const result = deleteTask(token, task.id);
  assert.equal(result, undefined);
});

test('deleteTask: invalid token throws Unauthorized', () => {
  reset();
  assert.throws(
    () => deleteTask('bad-token', 'some-id'),
    { message: 'Unauthorized' },
  );
});

test('deleteTask: unknown id throws Not found', () => {
  reset();
  const token = setupUser('alice');
  assert.throws(
    () => deleteTask(token, 'nonexistent-id'),
    { message: 'Not found' },
  );
});

test('deleteTask: another user\'s task throws Not found', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');
  const bobTask = createTask(bobToken, { title: "Bob's task" });

  assert.throws(
    () => deleteTask(aliceToken, bobTask.id),
    { message: 'Not found' },
  );
});

// ---------------------------------------------------------------------------
// Cross-user isolation — TASKS-001-06
// ---------------------------------------------------------------------------

test('cross-user isolation: user A tasks not visible to user B via getTasks', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');

  createTask(aliceToken, { title: "Alice task 1" });
  createTask(aliceToken, { title: "Alice task 2" });
  createTask(bobToken, { title: "Bob task 1" });

  const bobTasks = getTasks(bobToken);
  assert.equal(bobTasks.length, 1);
  assert.ok(bobTasks.every(t => t.owner === 'bob'));
});

test('cross-user isolation: user A cannot delete user B task', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');
  const bobTask = createTask(bobToken, { title: "Bob's task" });

  assert.throws(
    () => deleteTask(aliceToken, bobTask.id),
    { message: 'Not found' },
  );

  // Bob's task is still present
  const still = getTask(bobToken, bobTask.id);
  assert.equal(still.id, bobTask.id);
});

test('cross-user isolation: user A cannot update user B task', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');
  const bobTask = createTask(bobToken, { title: "Bob's original title" });

  assert.throws(
    () => updateTask(aliceToken, bobTask.id, { title: 'Hacked' }),
    { message: 'Not found' },
  );

  // Bob's task title is unchanged
  const unchanged = getTask(bobToken, bobTask.id);
  assert.equal(unchanged.title, "Bob's original title");
});

test('cross-user isolation: multiple users each see only their own tasks', () => {
  reset();
  const aliceToken = setupUser('alice');
  const bobToken = setupUser('bob', 'bobpw');
  const carolToken = setupUser('carol', 'carolpw');

  createTask(aliceToken, { title: 'A1' });
  createTask(aliceToken, { title: 'A2' });
  createTask(bobToken, { title: 'B1' });
  createTask(carolToken, { title: 'C1' });
  createTask(carolToken, { title: 'C2' });
  createTask(carolToken, { title: 'C3' });

  assert.equal(getTasks(aliceToken).length, 2);
  assert.equal(getTasks(bobToken).length, 1);
  assert.equal(getTasks(carolToken).length, 3);
});
