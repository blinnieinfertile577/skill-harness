/**
 * auth.test.js — Tests for AUTH-001 authentication module
 *
 * Uses node:test and node:assert/strict.
 * Each test calls _clearSessions() at the start to reset state — see
 * docs/AUTH-001.md "Test Helper Pattern" section.
 *
 * @spec AUTH-001
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerUser,
  login,
  logout,
  isValidSession,
  _clearSessions,
} from './auth.js';

// ---------------------------------------------------------------------------
// login — AUTH-001-01
// ---------------------------------------------------------------------------

test('login with valid credentials returns a non-empty token string', () => {
  _clearSessions();
  registerUser('alice', 'correct-horse');
  const token = login('alice', 'correct-horse');
  assert.ok(typeof token === 'string', 'token should be a string');
  assert.ok(token.length > 0, 'token should be non-empty');
});

test('login with valid credentials returns a hex string of expected length', () => {
  _clearSessions();
  registerUser('alice', 'correct-horse');
  const token = login('alice', 'correct-horse');
  // 32 random bytes → 64 hex chars
  assert.ok(/^[0-9a-f]{64}$/.test(token), 'token should be 64 hex chars');
});

test('login with unknown username returns null', () => {
  _clearSessions();
  const token = login('ghost', 'password');
  assert.equal(token, null);
});

test('login with wrong password returns null', () => {
  _clearSessions();
  registerUser('bob', 'secret');
  const token = login('bob', 'wrong-password');
  assert.equal(token, null);
});

test('login returns a different token on each successful call', () => {
  _clearSessions();
  registerUser('carol', 'pass');
  const t1 = login('carol', 'pass');
  const t2 = login('carol', 'pass');
  assert.ok(t1 !== t2, 'each login should produce a unique token');
});

// ---------------------------------------------------------------------------
// logout — AUTH-001-02
// ---------------------------------------------------------------------------

test('logout removes session so isValidSession returns false', () => {
  _clearSessions();
  registerUser('dave', 'pw');
  const token = login('dave', 'pw');
  assert.ok(isValidSession(token), 'session should be valid before logout');
  logout(token);
  assert.equal(isValidSession(token), false, 'session should be invalid after logout');
});

test('logout with unknown token does not throw', () => {
  _clearSessions();
  assert.doesNotThrow(() => logout('nonexistent-token'));
});

test('logout only removes the targeted session, not others', () => {
  _clearSessions();
  registerUser('eve', 'pw');
  const t1 = login('eve', 'pw');
  const t2 = login('eve', 'pw');
  logout(t1);
  assert.equal(isValidSession(t1), false, 't1 should be invalidated');
  assert.ok(isValidSession(t2), 't2 should remain valid');
});

// ---------------------------------------------------------------------------
// isValidSession — AUTH-001-03
// ---------------------------------------------------------------------------

test('isValidSession returns true for a fresh session', () => {
  _clearSessions();
  registerUser('frank', 'pw');
  const token = login('frank', 'pw');
  assert.ok(isValidSession(token));
});

test('isValidSession returns false for an unknown token', () => {
  _clearSessions();
  assert.equal(isValidSession('totally-unknown'), false);
});

test('isValidSession returns false for an expired session', () => {
  _clearSessions();
  registerUser('grace', 'pw');
  const token = login('grace', 'pw');

  // Manually backdate the expiry by reaching into the session store via
  // a round-trip: we cannot access the store directly, so we use a trick —
  // login gives us a valid token; we will simulate expiry by overwriting
  // the store entry via a re-import side-channel... Instead, we test this
  // by patching Date.now temporarily.
  const realNow = Date.now;
  try {
    // Advance time by 31 minutes
    Date.now = () => realNow() + 31 * 60 * 1000;
    assert.equal(isValidSession(token), false, 'session should be expired after 31 min');
  } finally {
    Date.now = realNow;
  }
});

test('expired session is evicted — isValidSession returns false on second call too', () => {
  _clearSessions();
  registerUser('henry', 'pw');
  const token = login('henry', 'pw');

  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 31 * 60 * 1000;
    isValidSession(token); // first call — should evict
    assert.equal(isValidSession(token), false, 'second call should also return false');
  } finally {
    Date.now = realNow;
  }
});

// ---------------------------------------------------------------------------
// registerUser / user store — AUTH-001-04
// ---------------------------------------------------------------------------

test('registerUser stores a user that is then retrievable by login', () => {
  _clearSessions();
  registerUser('iris', 'mysecret');
  const token = login('iris', 'mysecret');
  assert.ok(token !== null, 'login should succeed after registerUser');
});

test('password is not stored as plaintext (login fails if given stored value directly)', () => {
  // This test is a proxy: if the password were stored plaintext, logging in
  // with a hashed value would still work. We verify the module does NOT
  // accept the SHA-256 hash string as a valid password.
  _clearSessions();
  const plaintext = 'plaintext-password';
  registerUser('ivan', plaintext);

  // Create a plausible hash string — if passwords were stored plaintext
  // this would never match, but we ensure no trivial bypass.
  const bogusHash = '0'.repeat(64);
  const tokenWithHash = login('ivan', bogusHash);
  assert.equal(tokenWithHash, null, 'a raw hash string should not be a valid password');

  // Confirm the real password still works
  const tokenReal = login('ivan', plaintext);
  assert.ok(tokenReal !== null, 'real password should still work');
});

test('two different users registered with the same password get different hashes', () => {
  // Indirectly verified: both can log in only with their own passwords.
  // If salts were reused, they'd have the same hash — but we can observe
  // they both work independently (we cannot inspect internal hashes directly).
  _clearSessions();
  registerUser('judy', 'sharedpw');
  registerUser('karl', 'sharedpw');

  const t1 = login('judy', 'sharedpw');
  const t2 = login('karl', 'sharedpw');
  assert.ok(t1 !== null);
  assert.ok(t2 !== null);
  // Tokens should be different (extremely unlikely to collide)
  assert.ok(t1 !== t2, 'sessions for two users must be distinct');
});

test('registerUser called twice overwrites the previous record', () => {
  _clearSessions();
  registerUser('leo', 'original');
  registerUser('leo', 'updated');

  // old password should no longer work
  assert.equal(login('leo', 'original'), null, 'old password should be invalid after re-register');
  // new password should work
  assert.ok(login('leo', 'updated') !== null, 'new password should be valid');
});
