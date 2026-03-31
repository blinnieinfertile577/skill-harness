/**
 * auth.js — Authentication module
 *
 * Provides user registration, login, logout, and session validation.
 * All state is in-memory (no persistence). See docs/AUTH-001.md for full spec.
 * Login rate limiting added in Session 3 — see docs/RATELIMIT-001.md.
 *
 * @spec AUTH-001
 * @implements login,logout,isValidSession,registerUser,passwordHashing
 * @evidence E0
 *
 * @spec RATELIMIT-001
 * @implements rateLimiting
 * @evidence E0
 */

import { createHash, randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * User store: Map<username, { username, hash, salt }>
 * Never access this directly from outside — use exported functions.
 *
 * @spec AUTH-001
 * @implements userStore
 * @evidence E0
 */
const _userStore = new Map();

/**
 * Session store: Map<token, { username, token, expiresAt }>
 * Never access this directly from outside — use exported functions.
 *
 * @spec AUTH-001
 * @implements sessionStore
 * @evidence E0
 */
const _sessionStore = new Map();

/**
 * Failure store: Map<username, number[]>
 * Tracks timestamps of consecutive failed login attempts per username.
 * Never access this directly from outside — use exported functions.
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-01 — failure tracking per username
 * @evidence E0
 */
const _failureStore = new Map();

/** Session duration in milliseconds: 30 minutes. */
const SESSION_DURATION_MS = 30 * 60 * 1000;

/**
 * Maximum consecutive failures within the window before lockout.
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-02 — lockout threshold
 * @evidence E0
 */
const MAX_FAILURES = 5;

/**
 * Rolling window duration for failure counting: 15 minutes.
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-02 — rolling window definition
 * @evidence E0
 */
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hash a password with a given salt using SHA-256.
 *
 * @param {string} salt     — hex-encoded 16-byte salt
 * @param {string} password — plaintext password
 * @returns {string} hex SHA-256 digest of (salt + password)
 *
 * @spec AUTH-001
 * @implements passwordHashing
 * @evidence E0
 */
function _hashPassword(salt, password) {
  return createHash('sha256').update(salt + password).digest('hex');
}

/**
 * Prune failure timestamps older than LOCKOUT_WINDOW_MS for a username and
 * return the remaining (still-within-window) timestamps.
 *
 * @param {string} username
 * @returns {number[]} array of failure timestamps within the current window
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-02 — rolling window evaluation
 * @evidence E0
 */
function _getRecentFailures(username) {
  const now = Date.now();
  const cutoff = now - LOCKOUT_WINDOW_MS;
  const all = _failureStore.get(username) ?? [];
  const recent = all.filter(ts => ts > cutoff);
  if (recent.length === 0) {
    _failureStore.delete(username);
  } else {
    _failureStore.set(username, recent);
  }
  return recent;
}

/**
 * Record a failed login attempt for a username by appending the current
 * timestamp to the failure store.
 *
 * @param {string} username
 * @returns {void}
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-01 — failure tracking per username
 * @evidence E0
 */
function _recordFailure(username) {
  const recent = _getRecentFailures(username);
  recent.push(Date.now());
  _failureStore.set(username, recent);
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Register a new user in the user store.
 * Generates a fresh random salt and stores the hashed password.
 * Calling again with the same username overwrites the previous record.
 *
 * AUTH-001-04: passwords stored as { hash, salt }, never as plaintext.
 * Salt is 16 random bytes (hex-encoded). Hash is SHA-256(salt + password).
 *
 * @param {string} username — unique user identifier
 * @param {string} password — plaintext password (will be hashed immediately)
 * @returns {void}
 *
 * @spec AUTH-001
 * @implements registerUser
 * @evidence E0
 */
export function registerUser(username, password) {
  const salt = randomBytes(16).toString('hex');
  const hash = _hashPassword(salt, password);
  _userStore.set(username, { username, hash, salt });
}

/**
 * Attempt to log in with a username and password.
 * Returns a fresh session token on success, or null on failure.
 *
 * AUTH-001-01: SHA-256+salt verification, 32-byte random token, 30-min expiry.
 * Returns null if username does not exist or password is incorrect.
 *
 * RATELIMIT-001: Throws if the username has accumulated 5+ failed attempts
 * within the rolling 15-minute window. Resets the failure counter on success.
 *
 * @param {string} username
 * @param {string} password — plaintext
 * @returns {string|null} session token (hex 32-byte) or null
 * @throws {Error} "Account locked: too many failed login attempts" when locked out
 *
 * @spec AUTH-001
 * @implements login
 * @evidence E0
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-02 — lockout check before authentication
 * @implements RATELIMIT-001-03 — reset counter on successful login
 * @evidence E0
 */
export function login(username, password) {
  // RATELIMIT-001-02: Check lockout before attempting authentication.
  // Once MAX_FAILURES (5) failures are on record in the rolling window,
  // the account is locked and every further attempt throws immediately.
  // This means attempts 1–5 return null (recording failures); attempt 6+
  // throws. Successful logins clear the counter (RATELIMIT-001-03).
  const recentFailures = _getRecentFailures(username);
  if (recentFailures.length >= MAX_FAILURES) {
    throw new Error('Account locked: too many failed login attempts');
  }

  const user = _userStore.get(username);
  if (!user) {
    // RATELIMIT-001-01: Unknown username counts as a failure.
    _recordFailure(username);
    return null;
  }

  const hash = _hashPassword(user.salt, password);
  if (hash !== user.hash) {
    // RATELIMIT-001-01: Wrong password counts as a failure.
    _recordFailure(username);
    return null;
  }

  // RATELIMIT-001-03: Successful login — clear the failure record.
  _failureStore.delete(username);

  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  _sessionStore.set(token, { username, token, expiresAt });
  return token;
}

/**
 * Log out by invalidating a session token.
 * No-op if the token does not exist (AUTH-001-02).
 *
 * @param {string} token — session token returned by login()
 * @returns {void}
 *
 * @spec AUTH-001
 * @implements logout
 * @evidence E0
 */
export function logout(token) {
  _sessionStore.delete(token);
}

/**
 * Check whether a session token is currently valid (exists and not expired).
 * Expired sessions are lazily evicted on access (AUTH-001-03).
 *
 * @param {string} token — session token to validate
 * @returns {boolean} true if session exists and has not expired
 *
 * @spec AUTH-001
 * @implements isValidSession
 * @evidence E0
 */
export function isValidSession(token) {
  const session = _sessionStore.get(token);
  if (!session) return false;

  if (Date.now() >= session.expiresAt) {
    // Lazy eviction of expired session
    _sessionStore.delete(token);
    return false;
  }

  return true;
}

/**
 * Return the username associated with a valid session token, or null if the
 * session does not exist or has expired. Callers MUST check isValidSession()
 * (or handle the null return) before using the result.
 *
 * AUTH-001-03: session lookup uses the same lazy-eviction path as
 * isValidSession, so expired sessions are evicted here too.
 *
 * @param {string} token — session token returned by login()
 * @returns {string|null} username, or null if session is invalid/expired
 *
 * @spec AUTH-001
 * @implements getSessionUser
 * @evidence E0
 */
export function getSessionUser(token) {
  const session = _sessionStore.get(token);
  if (!session) return null;

  if (Date.now() >= session.expiresAt) {
    _sessionStore.delete(token);
    return null;
  }

  return session.username;
}

/**
 * TEST HELPER — Reset both the user store and the session store to empty.
 *
 * Call this at the start of every test that mutates state to prevent
 * test-order dependencies. MUST NOT be called in production code.
 * The leading underscore signals test-only usage. See docs/AUTH-001.md
 * "Patterns Established" section for details.
 *
 * NOTE: This does NOT clear the rate limiter store. Tests that also need a
 * clean rate limiter state must call _clearRateLimiter() separately.
 *
 * @returns {void}
 *
 * @spec AUTH-001
 * @implements testHelper
 * @evidence E0
 */
export function _clearSessions() {
  _userStore.clear();
  _sessionStore.clear();
}

/**
 * TEST HELPER — Reset the failure store (rate limiter state) to empty.
 *
 * Call this at the start of any test that exercises rate limiting behaviour
 * to prevent test-order dependencies. MUST NOT be called in production code.
 * The leading underscore signals test-only usage. See docs/RATELIMIT-001.md
 * "Patterns Established" section for details.
 *
 * @returns {void}
 *
 * @spec RATELIMIT-001
 * @implements RATELIMIT-001-05 — test helper for rate limiter isolation
 * @evidence E0
 */
export function _clearRateLimiter() {
  _failureStore.clear();
}
