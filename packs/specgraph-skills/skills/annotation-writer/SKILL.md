---
name: annotation-writer
description: Write correct @spec JSDoc annotations in source files to link code to specgraph spec documents and produce E0 evidence.
---

Add `@spec` annotations to source files so specgraph's AnnotationProvider can scan them and produce E0 evidence.

## Annotation syntax

```typescript
/**
 * @spec SPEC-ID @implements ComponentName
 */
```

Or inline:

```typescript
/** @spec SPEC-ID @implements ComponentName */
```

Multiple specs on one component — use separate blocks:

```typescript
/** @spec AUTH-001 @implements TokenValidator */
/** @spec AUTH-002 @implements SessionStore */
export class AuthService { ... }
```

## Relation types

| Annotation | Evidence relation | Use when |
|-----------|------------------|----------|
| `@implements` | IMPLEMENTS | This code directly implements the spec |
| `@verifies` | VERIFIED_BY | This is a test that verifies the spec |
| `@satisfies` | IMPLEMENTS | Alias for `@implements` |
| `@model` | MODEL | This symbol is a data model referenced by the spec |
| `@test` | VERIFIED_BY | This file is a test file for the spec |
| `@api` | IMPLEMENTS | This is an API endpoint implementing the spec |

## Placement rules

1. **Functions/methods** — annotate the JSDoc block immediately above the function.
2. **Classes** — annotate the class JSDoc block; all public methods are covered.
3. **Files** — annotate the top-level `export` if the whole file implements one spec.
4. **Tests** — use `@verifies` on test functions or `describe` blocks.

## TypeScript examples

```typescript
/**
 * Validates a JWT token and returns the decoded payload.
 * @spec AUTH-001 @implements TokenValidator
 */
export function validateToken(token: string): Payload { ... }

/**
 * @spec TASK-003 @verifies TodoFiltering
 */
describe('todo filters', () => { ... });

/**
 * @spec USER-002 @model UserModel
 * @spec USER-002 @api POST /users
 */
export class UserController { ... }
```

## JavaScript (CommonJS) example

```javascript
/**
 * @spec API-002 @implements RateLimiter
 */
module.exports.rateLimiter = function(req, res, next) { ... };
```

## Multi-language support

Python, Go, Rust, Java, C#, Ruby, and most languages are supported via `#`, `//`, `/* */`, and `"""` comment styles.

```python
# @spec AUTH-001 @implements TokenValidator
def validate_token(token: str) -> dict: ...
```

```go
// @spec API-002 @implements RateLimiter
func RateLimiter(next http.Handler) http.Handler { ... }
```

## Rules

1. Use the exact spec ID as it appears in the spec file frontmatter (`id:` field).
2. One annotation per `@spec` tag — do not chain multiple `@spec` tags in one block.
3. `ComponentName` after `@implements` is free text — use something meaningful to the reader.
4. After adding annotations, run `specgraph verify` to confirm the claims are detected.
5. If claims are not appearing, check that the file extension is in `annotationProvider.extensions` in `.specgraph/config.json` (defaults: `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs`, `.cjs`).
6. Config file is `.specgraph/config.json` (falls back to `.agent-docs/config.json`).
