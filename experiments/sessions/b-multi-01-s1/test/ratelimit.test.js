/**
 * ratelimit.test.js — Tests for login rate limiting in the auth module
 *
 * Runtime: node:test + node:assert/strict (no external dependencies).
 * Run with: node --test test/ratelimit.test.js
 *
 * All time simulation is done via _setNowFn() so no real sleeps are needed.
 * _reset() is called in beforeEach which also restores the real clock.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  register,
  login,
  RATE_LIMIT_MAX_FAILURES,
  RATE_LIMIT_WINDOW_MS,
  _reset,
  _resetRateLimiter,
  _setNowFn,
} from '../src/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register a user and return a helper that calls login() for them.
 *
 * @param {string} username
 * @param {string} password
 */
function setupUser(username = 'alice', password = 'correctpass') {
  register(username, password);
  return { username, password };
}

/**
 * Attempt login with a wrong password n times, ignoring the thrown errors.
 * Returns the last error thrown.
 *
 * @param {string} username
 * @param {number} n
 * @returns {Error}
 */
function failLoginTimes(username, n) {
  let lastErr;
  for (let i = 0; i < n; i++) {
    try {
      login(username, `wrongpass_${i}`);
    } catch (e) {
      lastErr = e;
    }
  }
  return lastErr;
}

// ---------------------------------------------------------------------------
// Rate limiting — basic lockout
// ---------------------------------------------------------------------------

describe('rate limiting — lockout after 5 failures', () => {
  beforeEach(() => _reset());

  it('first 4 failed attempts do not throw a lockout error', () => {
    setupUser();
    for (let i = 0; i < 4; i++) {
      const err = assert.throws(
        () => login('alice', `bad${i}`),
        (e) => {
          // Must be a credential error, NOT a lockout error
          assert.match(e.message, /Invalid username or password/);
          return true;
        },
      );
    }
  });

  it('5th consecutive failed attempt throws lockout error', () => {
    setupUser();
    failLoginTimes('alice', 4); // 4 failures — no lockout yet
    assert.throws(
      () => login('alice', 'wrongagain'),
      /Account locked: too many failed login attempts/,
    );
  });

  it('further attempts after lockout continue to throw lockout error', () => {
    setupUser();
    failLoginTimes('alice', RATE_LIMIT_MAX_FAILURES); // reach lockout
    // 3 more attempts should all throw lockout, not credential error
    for (let i = 0; i < 3; i++) {
      assert.throws(
        () => login('alice', 'whatever'),
        /Account locked: too many failed login attempts/,
      );
    }
  });

  it('correct password also rejected while account is locked', () => {
    const { password } = setupUser();
    failLoginTimes('alice', RATE_LIMIT_MAX_FAILURES);
    assert.throws(
      () => login('alice', password),
      /Account locked: too many failed login attempts/,
    );
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — successful login resets counter
// ---------------------------------------------------------------------------

describe('rate limiting — successful login resets failure counter', () => {
  beforeEach(() => _reset());

  it('successful login after fewer than 5 failures clears the counter', () => {
    const { password } = setupUser();
    failLoginTimes('alice', 4); // 4 failures — no lockout yet
    // Correct login should succeed and clear the counter
    assert.doesNotThrow(() => login('alice', password));
  });

  it('after a successful login, a fresh set of up-to-4 failures does not lock', () => {
    const { password } = setupUser();
    failLoginTimes('alice', 4);
    login('alice', password); // resets counter
    // Now 4 more failures should still not lock
    for (let i = 0; i < 4; i++) {
      assert.throws(() => login('alice', `bad${i}`), /Invalid username or password/);
    }
  });

  it('after a successful login, 5 new failures lock the account again', () => {
    const { password } = setupUser();
    failLoginTimes('alice', 3);
    login('alice', password); // clears counter
    failLoginTimes('alice', 4); // 4 failures after reset — no lockout
    assert.throws(
      () => login('alice', 'lastbad'),
      /Account locked: too many failed login attempts/,
    );
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — per-username isolation
// ---------------------------------------------------------------------------

describe('rate limiting — per-username isolation', () => {
  beforeEach(() => _reset());

  it('locking alice does not affect bob', () => {
    register('alice', 'apass');
    register('bob', 'bpass');
    failLoginTimes('alice', RATE_LIMIT_MAX_FAILURES);
    // alice is now locked
    assert.throws(() => login('alice', 'apass'), /Account locked/);
    // bob should still be able to log in normally
    assert.doesNotThrow(() => login('bob', 'bpass'));
  });

  it('bob accumulating failures does not reduce alice\'s remaining attempts', () => {
    register('alice', 'apass');
    register('bob', 'bpass');
    // Bob fails 4 times — no lockout for bob yet, and should not affect alice
    failLoginTimes('bob', 4);
    // Alice should still have a full fresh window
    for (let i = 0; i < 4; i++) {
      assert.throws(() => login('alice', `bad${i}`), /Invalid username or password/);
    }
    // Alice's 5th failure locks alice only
    assert.throws(() => login('alice', 'bad4'), /Account locked/);
    // Bob can still log in with correct password
    assert.doesNotThrow(() => login('bob', 'bpass'));
  });

  it('_resetRateLimiter clears all users\' counters', () => {
    register('alice', 'apass');
    register('bob', 'bpass');
    failLoginTimes('alice', RATE_LIMIT_MAX_FAILURES);
    failLoginTimes('bob', RATE_LIMIT_MAX_FAILURES);
    _resetRateLimiter();
    // Both should now be unlocked
    assert.doesNotThrow(() => login('alice', 'apass'));
    assert.doesNotThrow(() => login('bob', 'bpass'));
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — rolling window / time-based expiry
// ---------------------------------------------------------------------------

describe('rate limiting — rolling window expiry via time injection', () => {
  beforeEach(() => _reset());

  it('failures older than RATE_LIMIT_WINDOW_MS do not count toward lockout', () => {
    const { password } = setupUser();

    // Simulate time: failures happen at t=0, then time advances past the window
    let fakeNow = 1_000_000;
    _setNowFn(() => fakeNow);

    // 4 failures at t=0
    failLoginTimes('alice', 4);

    // Advance time past the window
    fakeNow += RATE_LIMIT_WINDOW_MS + 1;

    // 4 more failures — these are within a new window, none of the old ones count
    for (let i = 0; i < 4; i++) {
      assert.throws(() => login('alice', `fresh_bad${i}`), /Invalid username or password/);
    }

    // Correct password should succeed (old failures expired, only 4 fresh ones)
    assert.doesNotThrow(() => login('alice', password));
  });

  it('lockout expires after RATE_LIMIT_WINDOW_MS passes from the last failure', () => {
    const { password } = setupUser();

    let fakeNow = 1_000_000;
    _setNowFn(() => fakeNow);

    // Trigger lockout (5 failures at fakeNow)
    failLoginTimes('alice', RATE_LIMIT_MAX_FAILURES);

    // Confirm locked
    assert.throws(() => login('alice', password), /Account locked/);

    // Advance time exactly to the window boundary — still locked (boundary is exclusive)
    fakeNow += RATE_LIMIT_WINDOW_MS;
    assert.throws(() => login('alice', password), /Account locked/);

    // Advance 1 ms past the window — all 5 timestamps are now outside the window
    fakeNow += 1;

    // Now the account should be unlocked
    assert.doesNotThrow(() => login('alice', password));
  });

  it('failures spread across the window do not lock if count stays below threshold', () => {
    const { password } = setupUser();

    let fakeNow = 1_000_000;
    _setNowFn(() => fakeNow);

    // Fail once, advance 1 minute, fail again — repeat across 4 minutes (4 failures)
    for (let i = 0; i < 4; i++) {
      try { login('alice', 'bad'); } catch (_) { /* expected */ }
      fakeNow += 60_000; // +1 minute
    }

    // 4 recent failures — still under threshold; correct password should work
    assert.doesNotThrow(() => login('alice', password));
  });

  it('a non-existent username is also subject to rate limiting', () => {
    let fakeNow = 2_000_000;
    _setNowFn(() => fakeNow);

    // Fail 5 times against a username that was never registered
    for (let i = 0; i < 4; i++) {
      assert.throws(() => login('ghost', `bad${i}`), /Invalid username or password/);
    }
    // 5th attempt triggers lockout for 'ghost'
    assert.throws(
      () => login('ghost', 'bad4'),
      /Account locked: too many failed login attempts/,
    );
  });
});
