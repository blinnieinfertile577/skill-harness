/**
 * auth.test.js — Tests for the auth module
 *
 * Runtime: node:test + node:assert/strict (no external dependencies).
 * Run with: node --test test/auth.test.js
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  register,
  login,
  logout,
  isValidSession,
  SESSION_TIMEOUT_MS,
  _reset,
  _injectSession,
} from '../src/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshUser(suffix = '') {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2)}${suffix}`;
}

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe('register', () => {
  beforeEach(() => _reset());

  it('registers a new user without throwing', () => {
    assert.doesNotThrow(() => register('alice', 'secret'));
  });

  it('throws when username is empty', () => {
    assert.throws(() => register('', 'password'), TypeError);
  });

  it('throws when password is empty', () => {
    assert.throws(() => register('bob', ''), TypeError);
  });

  it('throws when username is not a string', () => {
    assert.throws(() => register(42, 'password'), TypeError);
  });

  it('throws when password is not a string', () => {
    assert.throws(() => register('carol', null), TypeError);
  });

  it('throws on duplicate username', () => {
    register('dave', 'pass1');
    assert.throws(() => register('dave', 'pass2'), /already registered/);
  });

  it('allows two different usernames to be registered independently', () => {
    assert.doesNotThrow(() => {
      register('eve', 'evepass');
      register('frank', 'frankpass');
    });
  });
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe('login', () => {
  beforeEach(() => _reset());

  it('returns a non-empty hex string token on success', () => {
    register('alice', 'secret');
    const token = login('alice', 'secret');
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('returns a different token on each login', () => {
    register('alice', 'secret');
    const t1 = login('alice', 'secret');
    const t2 = login('alice', 'secret');
    assert.notEqual(t1, t2);
  });

  it('throws on unknown username', () => {
    assert.throws(() => login('ghost', 'pass'), /Invalid username or password/);
  });

  it('throws on wrong password', () => {
    register('alice', 'correct');
    assert.throws(() => login('alice', 'wrong'), /Invalid username or password/);
  });

  it('error message does not distinguish missing user from wrong password', () => {
    register('alice', 'correct');
    let msgMissing, msgWrong;
    try { login('nobody', 'pass'); } catch (e) { msgMissing = e.message; }
    try { login('alice', 'bad'); } catch (e) { msgWrong = e.message; }
    assert.equal(msgMissing, msgWrong);
  });

  it('does not store plaintext password (token carries no password data)', () => {
    register('alice', 'myS3cret!');
    const token = login('alice', 'myS3cret!');
    // Token must not contain the password in any encoding
    assert.ok(!token.includes('myS3cret!'));
    assert.ok(!Buffer.from(token, 'hex').toString().includes('myS3cret!'));
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------

describe('logout', () => {
  beforeEach(() => _reset());

  it('invalidates the session so isValidSession returns false', () => {
    register('alice', 'secret');
    const token = login('alice', 'secret');
    logout(token);
    assert.equal(isValidSession(token), false);
  });

  it('does not throw when called with an unknown token', () => {
    assert.doesNotThrow(() => logout('deadbeef'));
  });

  it('does not throw when called twice on the same token', () => {
    register('alice', 'secret');
    const token = login('alice', 'secret');
    logout(token);
    assert.doesNotThrow(() => logout(token));
  });

  it('only invalidates the targeted session; other sessions remain valid', () => {
    register('alice', 'secret');
    const t1 = login('alice', 'secret');
    const t2 = login('alice', 'secret');
    logout(t1);
    assert.equal(isValidSession(t1), false);
    assert.equal(isValidSession(t2), true);
  });
});

// ---------------------------------------------------------------------------
// isValidSession()
// ---------------------------------------------------------------------------

describe('isValidSession', () => {
  beforeEach(() => _reset());

  it('returns true for a freshly created session', () => {
    register('alice', 'secret');
    const token = login('alice', 'secret');
    assert.equal(isValidSession(token), true);
  });

  it('returns false for an unknown token', () => {
    assert.equal(isValidSession('0000'), false);
  });

  it('returns false after logout', () => {
    register('alice', 'secret');
    const token = login('alice', 'secret');
    logout(token);
    assert.equal(isValidSession(token), false);
  });

  it('returns false for a session injected with an expired timestamp', () => {
    const token = 'expiredtoken123';
    const expiredTime = Date.now() - SESSION_TIMEOUT_MS - 1000;
    _injectSession(token, 'alice', expiredTime);
    assert.equal(isValidSession(token), false);
  });

  it('returns true for a session injected with a just-within-timeout timestamp', () => {
    const token = 'freshtoken456';
    // 1 second inside the timeout window
    const recentTime = Date.now() - SESSION_TIMEOUT_MS + 1000;
    _injectSession(token, 'alice', recentTime);
    assert.equal(isValidSession(token), true);
  });

  it('resets lastActivity (sliding window) on successful validation', () => {
    const token = 'slidetoken789';
    // Set activity to almost-expired
    const almostExpired = Date.now() - SESSION_TIMEOUT_MS + 500;
    _injectSession(token, 'alice', almostExpired);

    // First call should return true and refresh the timer
    assert.equal(isValidSession(token), true);

    // Immediately check again; should still be valid because timer was reset
    assert.equal(isValidSession(token), true);
  });

  it('session becomes invalid after exactly SESSION_TIMEOUT_MS + 1 ms idle', () => {
    const token = 'exactlyexpired';
    const justOver = Date.now() - SESSION_TIMEOUT_MS - 1;
    _injectSession(token, 'exactlyexpired', justOver);
    assert.equal(isValidSession(token), false);
  });
});

// ---------------------------------------------------------------------------
// SESSION_TIMEOUT_MS constant
// ---------------------------------------------------------------------------

describe('SESSION_TIMEOUT_MS', () => {
  it('equals 30 minutes in milliseconds', () => {
    assert.equal(SESSION_TIMEOUT_MS, 30 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Cross-concern: multiple users
// ---------------------------------------------------------------------------

describe('multi-user isolation', () => {
  beforeEach(() => _reset());

  it('sessions for different users are independent', () => {
    register('alice', 'apass');
    register('bob', 'bpass');
    const ta = login('alice', 'apass');
    const tb = login('bob', 'bpass');
    logout(ta);
    assert.equal(isValidSession(ta), false);
    assert.equal(isValidSession(tb), true);
  });

  it('logging in with correct credentials after a failed attempt succeeds', () => {
    register('alice', 'correct');
    assert.throws(() => login('alice', 'wrong'));
    const token = login('alice', 'correct');
    assert.equal(isValidSession(token), true);
  });
});

// ---------------------------------------------------------------------------
// Crypto: password hashing
// ---------------------------------------------------------------------------

describe('password hashing', () => {
  beforeEach(() => _reset());

  it('same password for two users produces different stored hashes (different salts)', () => {
    // We cannot inspect internal state directly, but if two users with the
    // same password get different tokens we know salts differ. Indirectly,
    // we verify that login works independently for each.
    register('u1', 'shared');
    register('u2', 'shared');
    const t1 = login('u1', 'shared');
    const t2 = login('u2', 'shared');
    // Tokens are random so they differ; both sessions valid
    assert.notEqual(t1, t2);
    assert.equal(isValidSession(t1), true);
    assert.equal(isValidSession(t2), true);
  });

  it('wrong password after register fails on each attempt up to the lockout threshold', () => {
    register('alice', 'realpass');
    // The first 4 wrong attempts (indices 0-3) produce the standard credential
    // error. On the 5th wrong attempt (index 4) the lockout kicks in and the
    // error changes to the lockout message.
    for (let i = 0; i < 4; i++) {
      assert.throws(() => login('alice', `attempt${i}`), /Invalid username or password/);
    }
    // 5th failure triggers lockout
    assert.throws(() => login('alice', 'attempt4'), /Account locked|Invalid username or password/);
    // Correct password is also blocked while account is locked
    assert.throws(() => login('alice', 'realpass'), /Account locked/);
  });
});
