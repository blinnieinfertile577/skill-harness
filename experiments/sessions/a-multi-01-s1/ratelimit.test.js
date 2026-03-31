/**
 * ratelimit.test.js — Tests for RATELIMIT-001 login rate limiting
 *
 * Uses node:test and node:assert/strict.
 * Each test calls _clearSessions() + _clearRateLimiter() at the start to reset
 * all state — see docs/RATELIMIT-001.md for details.
 *
 * Lockout behaviour: after 5 consecutive failed login attempts (each returning
 * null), every further attempt for that username throws "Account locked: too
 * many failed login attempts". A successful login at any point resets the counter.
 *
 * @spec RATELIMIT-001
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerUser,
  login,
  _clearSessions,
  _clearRateLimiter,
} from './auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reset() {
  _clearSessions();
  _clearRateLimiter();
}

/**
 * Make `count` wrong-password login attempts for `username`.
 * Assumes the username has been registered and fewer than MAX_FAILURES have
 * already been recorded (i.e., none of these calls will throw).
 */
function makeFails(username, count) {
  for (let i = 0; i < count; i++) {
    const result = login(username, '__wrong__');
    assert.equal(result, null, `fail attempt ${i + 1} should return null`);
  }
}

// ---------------------------------------------------------------------------
// RATELIMIT-001-02: Lockout after 5 consecutive failures
// ---------------------------------------------------------------------------

test('ratelimit: 5 consecutive failures each return null (not throw)', () => {
  reset();
  registerUser('alice', 'correct');
  // All 5 failures return null
  makeFails('alice', 5);
});

test('ratelimit: 6th attempt after 5 failures throws lockout error', () => {
  reset();
  registerUser('alice', 'correct');
  makeFails('alice', 5);
  // 6th attempt — must throw
  assert.throws(
    () => login('alice', '__wrong__'),
    { message: 'Account locked: too many failed login attempts' },
  );
});

test('ratelimit: lockout applies even when 6th attempt uses correct password', () => {
  reset();
  registerUser('alice', 'correct');
  makeFails('alice', 5);
  // Even the correct password is rejected while locked
  assert.throws(
    () => login('alice', 'correct'),
    { message: 'Account locked: too many failed login attempts' },
    'locked user should be rejected even with correct password',
  );
});

test('ratelimit: 7th and subsequent attempts continue to throw', () => {
  reset();
  registerUser('alice', 'correct');
  makeFails('alice', 5);
  for (let i = 0; i < 3; i++) {
    assert.throws(
      () => login('alice', '__wrong__'),
      { message: 'Account locked: too many failed login attempts' },
    );
  }
});

test('ratelimit: 4 consecutive failures do NOT trigger lockout (5th still returns null)', () => {
  reset();
  registerUser('alice', 'correct');
  makeFails('alice', 4);
  // 5th attempt — still returns null (not locked yet)
  const result = login('alice', '__wrong__');
  assert.equal(result, null, '5th failure should still return null');
});

test('ratelimit: unknown username failures also count toward lockout', () => {
  reset();
  // 'ghost' is not registered — each attempt returns null
  for (let i = 0; i < 5; i++) {
    const result = login('ghost', 'any');
    assert.equal(result, null, `ghost attempt ${i + 1} should return null`);
  }
  // 6th attempt throws lockout
  assert.throws(
    () => login('ghost', 'any'),
    { message: 'Account locked: too many failed login attempts' },
  );
});

// ---------------------------------------------------------------------------
// RATELIMIT-001-03: Reset counter on successful login
// ---------------------------------------------------------------------------

test('ratelimit: successful login after 4 failures clears the counter', () => {
  reset();
  registerUser('bob', 'correct');
  makeFails('bob', 4);
  // Successful login — resets counter, returns token
  const token = login('bob', 'correct');
  assert.ok(token !== null, 'successful login after 4 failures should return token');
  // Now 5 more failures should not yet trigger a lockout after the first 4
  makeFails('bob', 5);
  // 6th attempt after the fresh 5 should now throw
  assert.throws(
    () => login('bob', '__wrong__'),
    { message: 'Account locked: too many failed login attempts' },
  );
});

test('ratelimit: 4 failures + success + 4 more failures = no lockout yet', () => {
  reset();
  registerUser('carol', 'correct');

  makeFails('carol', 4);
  login('carol', 'correct'); // resets counter

  // 4 more failures — counter is now 4, no lockout yet
  makeFails('carol', 4);
  // 5th attempt after reset — still returns null (just reached 5 total since reset)
  const result = login('carol', '__wrong__');
  assert.equal(result, null, '5th failure after reset should still return null');
});

test('ratelimit: 4 failures + success + 5 failures + 6th attempt throws', () => {
  reset();
  registerUser('dave', 'correct');

  makeFails('dave', 4);
  login('dave', 'correct'); // resets counter

  makeFails('dave', 5);
  assert.throws(
    () => login('dave', '__wrong__'),
    { message: 'Account locked: too many failed login attempts' },
  );
});

// ---------------------------------------------------------------------------
// RATELIMIT-001-04: Per-username isolation
// ---------------------------------------------------------------------------

test('ratelimit: locking user A does not affect user B', () => {
  reset();
  registerUser('alice', 'correctA');
  registerUser('bob', 'correctB');

  // Lock alice (5 fails + 6th throws)
  makeFails('alice', 5);
  assert.throws(() => login('alice', '__wrong__'), {
    message: 'Account locked: too many failed login attempts',
  });

  // Bob is unaffected — correct login works
  const bobToken = login('bob', 'correctB');
  assert.ok(bobToken !== null, 'bob should still be able to log in while alice is locked');
});

test('ratelimit: each username has an independent failure counter', () => {
  reset();
  registerUser('alice', 'correctA');
  registerUser('bob', 'correctB');

  // Give alice 5 failures (locked)
  makeFails('alice', 5);

  // Give bob only 3 failures — not locked
  makeFails('bob', 3);

  // Alice is locked
  assert.throws(() => login('alice', '__wrong__'), {
    message: 'Account locked: too many failed login attempts',
  });

  // Bob still has 2 more attempts before lockout
  makeFails('bob', 2); // now bob has 5 failures

  // Bob's 6th attempt throws
  assert.throws(
    () => login('bob', '__wrong__'),
    { message: 'Account locked: too many failed login attempts' },
  );
});

// ---------------------------------------------------------------------------
// RATELIMIT-001-02: Lockout window expiry (time injection)
// ---------------------------------------------------------------------------

test('ratelimit: lockout expires after 15-minute window passes', () => {
  reset();
  registerUser('eve', 'correct');

  makeFails('eve', 5);

  // Confirm locked
  assert.throws(() => login('eve', '__wrong__'), {
    message: 'Account locked: too many failed login attempts',
  });

  // Advance time by 16 minutes — all failure timestamps fall outside window
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 16 * 60 * 1000;

    // Login with correct password should now succeed (lockout expired)
    const token = login('eve', 'correct');
    assert.ok(token !== null, 'login should succeed after lockout window expires');
  } finally {
    Date.now = realNow;
  }
});

test('ratelimit: failures at edge of window — old failures outside window are not counted', () => {
  reset();
  registerUser('frank', 'correct');

  const realNow = Date.now;

  // Record 3 failures 16 minutes ago (outside the 15-minute window)
  const baseTime = realNow();
  try {
    Date.now = () => baseTime - 16 * 60 * 1000;
    for (let i = 0; i < 3; i++) {
      login('frank', '__wrong__'); // these record failures in the "past"
    }
  } finally {
    Date.now = realNow;
  }

  // Now at "real" time, add 5 more failures — only the 5 recent ones count
  // (the 3 old ones are beyond the 15-min window and are pruned)
  for (let i = 0; i < 5; i++) {
    // Should NOT throw — only i+1 recent failures (old 3 are outside window)
    const result = login('frank', '__wrong__');
    assert.equal(result, null, `recent failure ${i + 1} should return null`);
  }

  // 6th recent attempt triggers lockout
  assert.throws(
    () => login('frank', '__wrong__'),
    { message: 'Account locked: too many failed login attempts' },
  );
});
