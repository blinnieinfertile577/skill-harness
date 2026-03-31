/**
 * auth.js — Authentication module
 *
 * Provides login, logout, and isValidSession.
 *
 * Design decisions:
 * - Passwords are never stored in plaintext. Each credential is hashed as
 *   SHA-256(salt + password) where salt is 16 cryptographically random bytes
 *   encoded as hex. The salt is stored alongside the hash so verification
 *   can reproduce the same digest.
 * - Sessions are keyed by a 32-byte cryptographically random token returned
 *   as a hex string. Tokens are not derived from user data, so they carry no
 *   information about the account.
 * - Inactivity expiry: every call to isValidSession that succeeds resets the
 *   session's lastActivity timestamp. Sessions idle for more than
 *   SESSION_TIMEOUT_MS (30 minutes) are considered expired and are removed.
 * - All state is held in memory (Map objects). This module is intentionally
 *   stateless across process restarts; persistence is the caller's concern.
 * - ESM-only; uses node:crypto exclusively for all crypto primitives.
 */

import { createHash, randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 30 minutes expressed in milliseconds. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Number of consecutive failed login attempts before a username is locked.
 * @type {number}
 */
export const RATE_LIMIT_MAX_FAILURES = 5;

/**
 * Rolling window duration for rate limiting, in milliseconds (15 minutes).
 * Once RATE_LIMIT_MAX_FAILURES failures accumulate within this window, the
 * account is locked until 15 minutes after the most recent failure.
 * @type {number}
 */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Credential store: username → { salt: string, hash: string }
 * @type {Map<string, { salt: string, hash: string }>}
 */
const credentials = new Map();

/**
 * Session store: token → { username: string, lastActivity: number }
 * @type {Map<string, { username: string, lastActivity: number }>}
 */
const sessions = new Map();

/**
 * Rate-limit store: username → Array<number> of failed-attempt timestamps (epoch ms).
 * Only timestamps within the rolling RATE_LIMIT_WINDOW_MS are retained.
 * @type {Map<string, number[]>}
 */
const failedAttempts = new Map();

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256(saltHex + password) and return the hex digest.
 *
 * @param {string} saltHex  Hex-encoded salt bytes.
 * @param {string} password Plaintext password (never persisted).
 * @returns {string} Hex-encoded SHA-256 digest.
 */
function hashPassword(saltHex, password) {
  return createHash('sha256').update(saltHex + password).digest('hex');
}

/**
 * Return a cryptographically random hex token.
 *
 * @param {number} [bytes=32] Number of random bytes.
 * @returns {string} Hex-encoded token.
 */
function generateToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Remove all sessions that have exceeded SESSION_TIMEOUT_MS of inactivity.
 * Called lazily on every public operation.
 */
function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      sessions.delete(token);
    }
  }
}

/**
 * Return the current time in milliseconds. Separated into its own function so
 * tests can override it via _setNowFn() to simulate the passage of time.
 * @type {() => number}
 */
let _nowFn = () => Date.now();

/**
 * Record a failed login attempt for username and throw a lockout error if
 * RATE_LIMIT_MAX_FAILURES failures have occurred within RATE_LIMIT_WINDOW_MS.
 *
 * The timestamps array is pruned to only include entries within the rolling
 * window before checking the count, so old failures naturally fall off.
 *
 * @param {string} username
 * @returns {void}
 * @throws {Error} If the account is now locked due to too many failures.
 */
function recordFailedAttempt(username) {
  const now = _nowFn();
  // Cutoff is inclusive: a failure at exactly (now - RATE_LIMIT_WINDOW_MS) is
  // still considered within the window. A failure strictly before that point
  // has expired. This matches the semantics: lock holds until RATE_LIMIT_WINDOW_MS
  // milliseconds have elapsed since the failure timestamp.
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  let attempts = failedAttempts.get(username) ?? [];
  // Prune timestamps that are strictly before the cutoff (already expired)
  attempts = attempts.filter((ts) => ts >= cutoff);
  attempts.push(now);
  failedAttempts.set(username, attempts);

  if (attempts.length >= RATE_LIMIT_MAX_FAILURES) {
    throw new Error('Account locked: too many failed login attempts');
  }
}

/**
 * Check whether a username is currently locked out and throw if so.
 *
 * A username is locked when it has accumulated RATE_LIMIT_MAX_FAILURES or more
 * failed attempts all falling within the rolling RATE_LIMIT_WINDOW_MS window.
 *
 * @param {string} username
 * @returns {void}
 * @throws {Error} If the account is locked.
 */
function checkLockout(username) {
  const now = _nowFn();
  // Same inclusive cutoff as recordFailedAttempt for consistent boundary semantics.
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  const attempts = failedAttempts.get(username);
  if (!attempts) return;

  const recent = attempts.filter((ts) => ts >= cutoff);
  if (recent.length >= RATE_LIMIT_MAX_FAILURES) {
    throw new Error('Account locked: too many failed login attempts');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new user with the given username and password.
 *
 * Throws if the username is already registered.
 *
 * @param {string} username
 * @param {string} password Plaintext; hashed before storage.
 * @returns {void}
 */
export function register(username, password) {
  if (typeof username !== 'string' || username.length === 0) {
    throw new TypeError('username must be a non-empty string');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('password must be a non-empty string');
  }
  if (credentials.has(username)) {
    throw new Error(`User "${username}" is already registered`);
  }
  const salt = randomBytes(16).toString('hex');
  const hash = hashPassword(salt, password);
  credentials.set(username, { salt, hash });
}

/**
 * Authenticate a user and create a new session.
 *
 * @param {string} username
 * @param {string} password Plaintext; verified against stored hash.
 * @returns {string} Session token (hex string).
 * @throws {Error} If credentials are invalid.
 */
export function login(username, password) {
  purgeExpiredSessions();

  // Reject immediately if the account is already locked out.
  checkLockout(username);

  const cred = credentials.get(username);
  if (!cred) {
    // Deliberate constant-time-ish phrasing; do not distinguish "no user" from
    // "wrong password" in the public error message.
    // Still record the failed attempt so that repeated probing of non-existent
    // usernames also triggers rate limiting.
    recordFailedAttempt(username);
    throw new Error('Invalid username or password');
  }

  const candidate = hashPassword(cred.salt, password);
  if (candidate !== cred.hash) {
    recordFailedAttempt(username);
    throw new Error('Invalid username or password');
  }

  // Successful login: clear any accumulated failure record for this username.
  failedAttempts.delete(username);

  const token = generateToken();
  sessions.set(token, { username, lastActivity: _nowFn() });
  return token;
}

/**
 * Invalidate a session token.
 *
 * Silently succeeds if the token is unknown or already expired.
 *
 * @param {string} token Session token returned by login.
 * @returns {void}
 */
export function logout(token) {
  purgeExpiredSessions();
  sessions.delete(token);
}

/**
 * Check whether a session token is currently valid.
 *
 * A session is valid if it exists and has not exceeded SESSION_TIMEOUT_MS of
 * inactivity. Calling this function resets the inactivity timer for valid
 * sessions (sliding window expiry).
 *
 * @param {string} token Session token returned by login.
 * @returns {boolean} true if the session is active and unexpired.
 */
export function isValidSession(token) {
  purgeExpiredSessions();

  const session = sessions.get(token);
  if (!session) return false;

  // Session survived purgeExpiredSessions, so it is within the window.
  // Refresh the activity timestamp (sliding window).
  session.lastActivity = Date.now();
  return true;
}

/**
 * Resolve the username associated with an active session token.
 *
 * Returns the username string if the token is valid and unexpired, or throws
 * an Error if the token is invalid or expired. This is the intended way for
 * other modules (e.g. task management) to authenticate requests via a token
 * without duplicating session-lookup logic.
 *
 * Calling this function counts as activity and resets the sliding-window
 * expiry timer (identical semantics to isValidSession).
 *
 * @param {string} token Session token returned by login.
 * @returns {string} The username associated with the session.
 * @throws {Error} If the token is not found or has expired.
 */
export function getUsernameFromToken(token) {
  purgeExpiredSessions();

  const session = sessions.get(token);
  if (!session) {
    throw new Error('Invalid or expired session token');
  }

  // Refresh the activity timestamp (sliding window, same as isValidSession).
  session.lastActivity = Date.now();
  return session.username;
}

// ---------------------------------------------------------------------------
// Test-only helpers (exported for white-box testing)
// ---------------------------------------------------------------------------

/**
 * Reset all internal state. Intended only for test isolation.
 * Also resets the rate-limiter state and restores the real clock.
 */
export function _reset() {
  credentials.clear();
  sessions.clear();
  failedAttempts.clear();
  _nowFn = () => Date.now();
}

/**
 * Reset only the rate-limiter state (failed attempt counters).
 * Use this when you need to clear rate-limit state without affecting credentials
 * or sessions.
 */
export function _resetRateLimiter() {
  failedAttempts.clear();
}

/**
 * Override the internal clock function used by rate limiting and session
 * creation. Pass a function that returns a fixed or advancing epoch-ms value.
 * Restore the real clock by calling _reset() or by passing () => Date.now().
 *
 * @param {() => number} fn
 */
export function _setNowFn(fn) {
  _nowFn = fn;
}

/**
 * Directly inject a session with a specific lastActivity timestamp.
 * Intended only for testing expiry behaviour without real sleeps.
 *
 * @param {string} token
 * @param {string} username
 * @param {number} lastActivity  epoch ms
 */
export function _injectSession(token, username, lastActivity) {
  sessions.set(token, { username, lastActivity });
}
