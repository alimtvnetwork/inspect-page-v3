# Consolidated: Coding Guidelines — Complete Reference

**Source:** [`../02-coding-guidelines/`](../02-coding-guidelines/)  
**Updated:** 2026-04-22  
**Version:** 3.3.0

---

## Purpose

This is the **single consolidated reference** for all coding guidelines. An AI reading only this file must be able to enforce every rule without consulting the source specs. Each section maps to one or more source files — follow cross-references for deeper examples and edge cases.

### Source-Folder Coverage Map

The source module `spec/02-coding-guidelines/` contains **16 subfolders**. This consolidated reference covers every one of them. Use the section index below to jump directly to language- or topic-specific rules.

| Source Subfolder | Section | Status |
|------------------|---------|--------|
| `01-cross-language/` | §§1–21 (cross-cutting rules) | ✅ Full |
| `02-typescript/` | §22 TypeScript Standards | ✅ Full |
| `03-golang/` | §23 Go Standards | ✅ Full |
| `04-php/` | §24 PHP Standards | ✅ Full |
| `05-rust/` | §25 Rust Standards | ✅ Full |
| `06-ai-optimization/` | §26 AI Optimization | ✅ Full |
| `06-cicd-integration/` | §27 CI/CD Integration | ✅ Full |
| `07-csharp/` | §28 C# Standards | ✅ Full |
| `08-file-folder-naming/` | §29 File & Folder Naming | ✅ Full |
| `09-powershell-integration/` | §30 PowerShell Integration | ✅ Reference |
| `10-research/` | §31 Coding Research Placement | ✅ Reference |
| `11-security/` | §32 Security & Dependency Pinning | ✅ Full |
| `21-app/`, `22-app-issues/`, `23-app-db/`, `24-app-ui-design-system/` | §33 App-Specific Coding Specs | ✅ Reference |

---

## 1. Naming Conventions — Zero-Underscore Policy

**Source:** `01-cross-language/11-key-naming-pascalcase.md`, `22-variable-naming-conventions.md`, `10-function-naming.md`

### 1.1 PascalCase Is the Default for All Keys

**ALL string keys** across the project use PascalCase. This overrides language defaults (e.g., JavaScript's camelCase convention).

| Key Type | ❌ Wrong | ✅ Correct |
|----------|----------|-----------|
| JSON response/request keys | `"userId"`, `"createdAt"` | `"UserId"`, `"CreatedAt"` |
| Log context keys | `"errorCode"` | `"ErrorCode"` |
| Config keys (YAML/JSON) | `"readTimeout"` | `"ReadTimeout"` |
| PHP array keys | `$data['pluginVersion']` | `$data['PluginVersion']` |
| Database column names | `user_id`, `created_at` | `UserId`, `CreatedAt` |
| WebSocket message types | `"streamStart"` | `"StreamStart"` |

**Go struct rule:** Go serializes to PascalCase by default — **omit explicit JSON tags** unless `omitempty` or `json:"-"` is needed.

```go
// ✅ CORRECT — implicit PascalCase serialization
type User struct {
    Id        string
    SessionId string
    CreatedAt time.Time
}
// Serializes to: {"Id":"...","SessionId":"...","CreatedAt":"..."}
```

### 1.2 Language-Specific Identifier Conventions

| Language | Identifiers | Database Columns | Enum String Values |
|----------|-------------|------------------|--------------------|
| Go | PascalCase (exported), camelCase (unexported) | PascalCase | PascalCase |
| TypeScript | PascalCase (types/keys), camelCase (variables) | PascalCase | PascalCase |
| PHP | PascalCase (keys/values) | PascalCase | PascalCase |
| C# | PascalCase (methods/props) | PascalCase | PascalCase |
| **Rust** | **snake_case (RFC 430)** | **PascalCase** | **PascalCase** |

**Key rule:** Rust follows its community conventions for identifiers, but database names and enum string values are **always** PascalCase for cross-system consistency.

### 1.3 Abbreviation Standard

Common acronyms MUST use full uppercase: `AI`, `DB`, `CI/CD`, `PHP`, `UI`, `API`, `HTTP`, `URL`, `ID`. This overrides general PascalCase rules for these specific terms.

```go
// ❌ WRONG
type DbConfig struct { ... }
type ApiResponse struct { ... }

// ✅ CORRECT
type DBConfig struct { ... }
type APIResponse struct { ... }
```

### 1.4 Variable Naming

| Rule | ❌ Wrong | ✅ Correct |
|------|----------|-----------|
| Singular for one item | `$users = findById($id)` | `$user = findById($id)` |
| Plural for collections | `$user = findAll()` | `$users = findAll()` |
| Loop variable = singular of collection | `for x of plugins` | `for plugin of plugins` |
| Maps use `Map` or `By` suffix | `const prices = {}` | `const priceByProductId = {}` |

### 1.5 Function Naming — No Boolean Flag Parameters

When a boolean parameter changes the **meaning** of an operation, split into separate named methods:

```typescript
// ❌ FORBIDDEN
logMessage("Failed", true);  // What does true mean?

// ✅ REQUIRED
logMessage("User saved");
logMessageWithStack("Payment failed");
```

### 1.6 File/Folder Naming

| File Type | Convention | Example |
|-----------|-----------|---------|
| `.md` spec files | lowercase-kebab-case with numeric prefix | `02-boolean-principles.md` |
| Go files | snake_case | `deploy_path.go` |
| TypeScript files | kebab-case | `user-profile.tsx` |
| C# files | PascalCase | `UserProfile.cs` |
| PowerShell `.ps1` | lowercase-kebab-case | `run-validator.ps1` |
| PHP classes | PascalCase matching class name | `FileLogger.php` |
| PHP WordPress main file | kebab-case matching slug | `plugin-slug.php` |

### 1.7 Slugs

All slugs (URLs, API endpoints, file paths) MUST be **lowercase kebab-case**. Characters: `a-z`, `0-9`, `-` only. No underscores, spaces, dots, leading/trailing hyphens, or consecutive hyphens.

---

## 2. Boolean Principles (P1–P8)

**Source:** `01-cross-language/02-boolean-principles/` (5 files)

### P1: Always Use `is` or `has` Prefix

Every boolean — variable, property, parameter, or method — **must** start with `is` or `has`. 99% use `is`/`has`. The word `should` is acceptable in rare cases.

**Banned prefixes:** `can`, `was`, `will`, `not`, `no`.

```php
// ❌ FORBIDDEN
$active = true;
$loaded = false;

// ✅ REQUIRED
$isActive = true;
$isLoaded = false;
$hasPermission = true;
```

```typescript
// ❌ FORBIDDEN
const loading = true;

// ✅ REQUIRED
const isLoading = true;
```

```go
// ❌ FORBIDDEN
blocked := true

// ✅ REQUIRED
isBlocked := true
hasItems := len(items) > 0
```

Methods follow the same rule: `$order->hasOverdue()`, `$user->isAdmin()`.

### P2: Never Use Negative Words in Boolean Names

The words **`not`**, **`no`**, and **`non`** are **absolutely banned** from boolean names. Use a **positive semantic synonym** instead.

| ❌ Forbidden | ✅ Required | Meaning |
|-------------|------------|---------|
| `isNotReady` | `isPending` | Waiting |
| `hasNoPermission` | `isUnauthorized` | Lacks access |
| `isNotBlocked` | `isActive` | Active |
| `isClassNotLoaded` | `isClassUnregistered` | Not registered |
| `isNoRecentErrors` | `isErrorListClear` | Clean error list |

### P3: No Raw Negation Operators

**Never** use `!` or `not` on function calls or existence checks. Wrap every negative check in a **positively named guard function**.

| ❌ Forbidden | ✅ Required |
|-------------|------------|
| `!file_exists($path)` | `PathHelper::isFileMissing($path)` |
| `!is_dir($path)` | `PathHelper::isDirMissing($path)` |
| `!arr.includes(x)` | `isMissing(arr, x)` |
| `!strings.Contains(s, x)` | `IsMissing(s, x)` |
| `!$obj->isActive()` | `$obj->isDisabled()` |

### P4: Extract Complex Boolean Expressions

Any condition with more than **one operand** must be extracted into a named boolean variable or function.

```typescript
// ❌ FORBIDDEN
if (user.age >= 18 && user.hasVerifiedEmail && user.hasGoodStanding) { ... }

// ✅ REQUIRED
const isEligible = user.age >= 18 && user.hasVerifiedEmail;
const isAllowed = isEligible && user.hasGoodStanding;

if (isAllowed) { ... }
```

### P5: Explicit Boolean Parameters Only

Never pass `true`/`false` as unnamed arguments. Use named parameters, separate methods, or an options object.

### P6: Never Mix `&&` and `||` in a Single Condition

Max 2 operands per condition. Never mix `&&`/`||` without extracting sub-expressions.

```typescript
// ❌ FORBIDDEN
if (isAdmin && isActive || hasOverride) { ... }

// ✅ REQUIRED
const hasAccess = isAdmin && isActive;
const isAllowed = hasAccess || hasOverride;
if (isAllowed) { ... }
```

### P7–P8: No Inline Boolean Statements / No Raw System Calls in Conditions

P7: Never use `return condition ? true : false` — return the boolean directly.  
P8: Never call system functions (`file_exists`, `is_dir`) directly in conditions — always wrap in a named guard.

---

## 3. Code Style — Braces, Nesting, Spacing, Size

**Source:** `01-cross-language/04-code-style/` (7 files)

### Rule 1: Always Use Braces

Every `if`, `for`, `while` block **must** use curly braces `{}`, even for single-statement bodies.

### Rule 2: Zero Nested `if` — Absolute Ban

Nested `if` blocks are **forbidden**. Flatten using combined conditions, early returns, or extracted helpers.

```php
// ❌ FORBIDDEN
if ($error !== null) {
    if (ErrorChecker::isFatalError($error)) {
        $this->logger->fatal($error);
    }
}

// ✅ REQUIRED — isFatalError handles null internally
if (ErrorChecker::isFatalError($error)) {
    $this->logger->fatal($error);
}
```

Max nesting depth: **2 levels** (function body → one control structure). Max **2 operands** per conditional.

### Rule 3: No Redundant `else` After Return

If an `if` block ends with `return`, `throw`, `break`, or `continue`, the code after the block is implicitly the "else" branch. Adding an explicit `else` is **forbidden**.

```go
// ❌ FORBIDDEN — redundant else after return
if order == nil {
    return ErrNilOrder
} else {
    return process(order)
}

// ✅ REQUIRED — flat
if order == nil {
    return ErrNilOrder
}

return process(order)
```

**Exception:** `else` is acceptable when **neither branch returns** — both branches assign a value and execution continues.

### Rule 4: Blank Line Before `return`/`throw`

Insert one blank line before `return`/`throw` **only if** preceded by other code. If it's the only statement, no blank line.

### Rule 5: Blank Line After Closing `}`

A blank line is required after `}` **unless** the next line is another `if`, `else`, `case`, or closing `}`.

### Rule 6: Maximum 15 Lines Per Function

Every function body must be **≤ 15 lines** (excluding blank lines, comments, and the signature). Error-handling lines (`if err != nil`, `apperror.Wrap()`) are **exempt** from this count.

### Rule 17: Maximum 120 Lines Per Struct/Class

Structs, classes, and interfaces must not exceed 120 lines. Extract behavior into focused sub-types.

### File Size Limits

| Metric | Limit |
|--------|-------|
| Function body | ≤ 15 lines |
| File size | < 300 lines (hard max 400) |
| React components | < 100 lines |
| Struct/class | ≤ 120 lines |
| Parameters per function | ≤ 3 |
| Cognitive complexity | ≤ 10 |

---

## 4. Cyclomatic Complexity — Target Zero

**Source:** `01-cross-language/06-cyclomatic-complexity.md`

Target complexity of **0–1 per function** using guard clauses to eliminate nesting entirely. Every nested `if` adds a branch, increases indentation, and forces readers to mentally track multiple conditions.

### Resolution Methods

| Method | When to Use |
|--------|-------------|
| **Guard clauses (early return)** | Invert conditions, exit early, keep happy path at bottom |
| **Named boolean extraction** | Replace compound inline conditions with named variables |
| **Extract to named function** | Pull conditional logic into a helper with a descriptive name |

```csharp
// ❌ BAD — 5 levels of nesting (Complexity: 5)
public void Process(Order? order) {
    if (order != null) {
        if (order.IsVerified) {
            if (order.Items.Count > 0) { ... }
        }
    }
}

// ✅ GOOD — flat guard clauses (Complexity: 1)
public void Process(Order? order) {
    if (order == null) { return; }
    if (order.IsUnverified) { return; }
    var isItemListEmpty = order.Items.Count <= 0;
    if (isItemListEmpty) { return; }
    // All guards passed — process the order
    order.IsProcessed = true;
}
```

---

## 5. Strict Typing

**Source:** `01-cross-language/13-strict-typing.md`

Every function parameter, return value, and class property **must** have an explicit type declaration.

| Language | Key Rules |
|----------|-----------|
| PHP | All params, returns, and properties typed. Remove redundant `@param`/`@return` docblocks |
| TypeScript | `any` is **prohibited**. `unknown` only at parse boundaries with immediate narrowing |
| Go | `interface{}`/`any` prohibited in exported APIs. **Single return value:** `apperror.Result[T]` — never `(T, error)`. No type assertions `.(Type)` in business logic |
| Rust | No `unwrap()` in production code |
| C# | Nullable reference types enabled. All public methods explicitly typed |

### No Inline Return Types

```typescript
// ❌ FORBIDDEN — inline return type
function getUser(): { name: string; age: number } { ... }

// ✅ REQUIRED — named type
interface UserInfo { name: string; age: number }
function getUser(): UserInfo { ... }
```

---

## 6. Generic Return Types — No `interface{}`/`any`/`object`

**Source:** `01-cross-language/25-generic-return-types.md`

🔴 **CODE RED:** When a method returns different types based on context, use generic Result types or generics — never `interface{}`, `any`, `object`, or `unknown`.

```go
// ❌ BAD — interface{} return forces caller to cast
func (c *Cache) Get(key string) interface{} { return c.store[key] }

// ✅ GOOD — generic function
func Get[T any](c *Cache, key string) (T, bool) { ... }

// ✅ GOOD — Result wrapper (project pattern)
func (s *Service) ProcessOrder(input Input) apperror.Result[OrderData] { ... }
```

```typescript
// ❌ BAD — any return
function fetchData(endpoint: string): Promise<any> { ... }

// ✅ GOOD — generic function
async function fetchData<T>(endpoint: string): Promise<T> { ... }
```

**Rule:** If a function could return multiple types, split into separate typed methods instead of returning a union or `any`.

---

## 7. Casting Elimination

**Source:** `01-cross-language/03-casting-elimination-patterns.md`

Type assertions and casts are **banned** in business logic. Every cast is a potential runtime panic.

| Language | Forbidden Pattern | Required Alternative |
|----------|-------------------|---------------------|
| Go | `value.(Type)` | Generic functions, discriminated interfaces |
| TypeScript | `value as Type` | Type guards, `is` predicates |
| PHP | `(int)$val` | `intval()` with validation, `PhpNativeType` enum |
| C# | `(Type)value` | Pattern matching, `is` operator |

**Acceptable exceptions:**
- Parse boundaries (JSON decode, HTTP request body)
- Framework callbacks with predefined signatures
- Test code

---

## 8. Magic Values & Immutability

**Source:** `01-cross-language/26-magic-values-and-immutability.md`

### Rule: No Magic Strings or Numbers

Every string literal used in comparisons, switch statements, or assignments **must** be replaced with a named constant or enum.

```typescript
// ❌ FORBIDDEN — magic string
if (user.status === "active") { ... }

// ✅ REQUIRED — enum
if (user.status === UserStatus.Active) { ... }
```

### Rule: Immutable by Default

Use `const` over `let`/`var`. Reassignment is the exception, not the rule. In Go, prefer value receivers and avoid pointer mutation where possible.

---

## 9. Null Pointer Safety

**Source:** `01-cross-language/19-null-pointer-safety.md`

**Never access a pointer, array, or return value without checking for nil/null first.** Every pointer dereference is a potential panic/crash.

| Rule | Description |
|------|-------------|
| **Error before value** | Always check `err` before using the returned value |
| **Never chain method calls on unchecked returns** | Separate creation from execution, check after each step |
| **Check pointer before dereference** | Explicit nil check before `*ptr` |
| **Check array/slice before index access** | Nil and length check before `arr[0]` |

```go
// ❌ DANGEROUS — Output() called directly, will panic if command fails
output, err := exec.Command(args...).Output()

// ✅ SAFE — separate creation from execution
cmd, err := exec.Command(args...)
if err != nil || cmd == nil {
    return exitResult
}
output := cmd.Output()
```

---

## 10. Code Mutation Avoidance

**Source:** `01-cross-language/18-code-mutation-avoidance.md`

Minimize mutable state. Prefer creating new values over mutating existing ones.

| Rule | Detail |
|------|--------|
| Avoid mutating function parameters | Return new values instead of modifying inputs |
| Avoid global mutable state | Use dependency injection or explicit context |
| Avoid accumulator-style loops | Prefer `map`, `filter`, `reduce` where idiomatic |
| Mark mutations explicitly | If mutation is unavoidable, document it clearly |

---

## 11. DRY Principles

**Source:** `01-cross-language/08-dry-principles.md`

- **3+ lines** of identical logic → extract to function
- **2+ components** sharing state → extract to custom hook/service
- **2+ endpoints** sharing validation → extract to middleware
- Composition over inheritance — always

---

## 12. SOLID Principles

**Source:** `01-cross-language/23-solid-principles.md`

| Principle | Rule | Example |
|-----------|------|---------|
| **S — Single Responsibility** | One class/function = one reason to change | Split `PluginService` into `PluginService` (CRUD) + `PluginValidator` + `PluginFormatter` |
| **O — Open/Closed** | Open for extension, closed for modification | Use interfaces: `Exporter` interface → `CsvExporter`, `JsonExporter` |
| **L — Liskov Substitution** | Subtypes must be substitutable for their base type | Don't override methods to throw "not supported" |
| **I — Interface Segregation** | Many small interfaces > one fat interface | Split `Repository` into `Reader`, `Writer`, `Deleter` |
| **D — Dependency Inversion** | Depend on abstractions, not concrete types | Accept `Logger` interface, not `FileLogger` directly |

---

## 13. Lazy Evaluation

**Source:** `01-cross-language/16-lazy-evaluation-patterns.md`

Defer expensive computations until they are actually needed. Never compute values "just in case".

| Pattern | Rule |
|---------|------|
| Conditional computation | Only compute inside the branch that uses the result |
| Lazy initialization | Initialize resources on first access, not at startup |
| Short-circuit evaluation | Order conditions so cheap checks come first |

---

## 14. Regex Guidelines

**Source:** `01-cross-language/17-regex-usage-guidelines.md`

| Rule | Detail |
|------|--------|
| Name every regex | Assign to a named constant: `const emailPattern = /^.../` |
| Compile once | Pre-compile regex at module level, never inside loops |
| Comment complex patterns | Add inline comments for non-trivial regex |
| Prefer string methods first | Use `startsWith`, `endsWith`, `includes` when regex is overkill |

---

## 15. Test Naming & Structure

**Source:** `01-cross-language/14-test-naming-and-structure.md`

### Three-Part Convention

Every test function follows: `Test{Unit}_{Scenario}_{ExpectedOutcome}`

```go
// ❌ FORBIDDEN — vague
func TestCreateSession(t *testing.T) { ... }

// ✅ REQUIRED — three-part naming
func TestCreateSession_WithValidCredentials_ReturnsSessionId(t *testing.T) { ... }
func TestCreateSession_WithExpiredToken_ReturnsAuthError(t *testing.T) { ... }
```

```typescript
describe('UserProfile', () => {
    it('renders_WithValidUser_ShowsDisplayName', () => { ... });
    it('onSubmit_WithInvalidEmail_ShowsValidationError', () => { ... });
});
```

### Test File Rules

- One test file per source file — no multi-source test files
- Test file resides in same directory as source file
- Integration tests use `_integration_test.go` / `.integration.test.tsx` suffix

### Table-Driven Tests (Go)

```go
tests := []struct {
    Name     string
    Input    string
    Expected string
}{
    {Name: "EmptyInput_ReturnsDefault", Input: "", Expected: "default"},
    {Name: "ValidSlug_ReturnsTrimmed", Input: " my-slug ", Expected: "my-slug"},
}

for _, tt := range tests {
    t.Run(tt.Name, func(t *testing.T) {
        result := Process(tt.Input)
        assert.Equal(t, tt.Expected, result)
    })
}
```

---

## 16. Types Folder Convention

**Source:** `01-cross-language/27-types-folder-convention.md`

All shared type definitions live in a dedicated `types/` folder. No types defined inline in handler or service files.

| Language | Location | Convention |
|----------|----------|------------|
| Go | `internal/types/` | One file per domain (`user_types.go`, `session_types.go`) |
| TypeScript | `src/types/` | One file per domain (`user.types.ts`) |
| PHP | `includes/Enums/` | Backed enums with `Type` suffix |

---

## 17. Error Handling — 🔴 CODE RED

Swallowing errors is a **CODE RED** violation. Every error must be explicitly handled.

| Rule | Violation Level |
|------|----------------|
| Swallowed errors | 🔴 CODE RED |
| Generic "file not found" without exact path | 🔴 CODE RED (CODE-RED-009) |
| Missing error context/reason | 🔴 CODE RED |

```go
// ❌ CODE RED — swallowed error
result, _ := doSomething()

// ✅ REQUIRED — handle or propagate
result := doSomething()
if result.HasError() {
    return result.PropagateError()
}
```

---

## 18. Language-Specific Standards

### TypeScript

- No `any` — use generics or `unknown` with narrowing
- String-based enums with PascalCase keys and values
- `async/await` over raw promises
- `strict: true` in tsconfig — no exceptions
- Named interfaces for all discriminated union variants
- `TypedAction<TType, TPayload>` pattern for action types

### Go

- PascalCase for exports, camelCase for unexported
- `defer` for cleanup — defer runs LIFO, captures values at defer-time
- Error wrapping via `apperror.Wrap()` — never raw `fmt.Errorf`
- `Result[T]` pattern — single return value, never `(T, error)`
- No `interface{}`/`any` in exported APIs
- Enum: `type Variant byte` with `iota`, `Invalid` zero-value, mandatory `String()`, `Parse()`, `IsAnyOf()`
- Code severity taxonomy: 🔴 CODE RED (fatal) → 🟠 WARN → 🟡 STYLE → 🟢 BEST PRACTICE

### PHP

- PSR-12 compliance
- No `else` chains — use early returns
- `ResponseKeyType` enum for response keys
- String-backed enums with `isEqual()` method and `Type` suffix
- `TypeCheckerTrait` for type-safe validation: `isString()`, `isArray()`, `isInteger()`
- `PhpNativeType` enum for type validation (`String`, `Integer`, `Boolean`, `Array`, `Float`, `Null`)

### Rust

- snake_case for identifiers (RFC 430)
- PascalCase for DB columns and enum string values
- `thiserror` for error types
- No `unwrap()` in production — use `?` operator
- `Debug`, `Clone`, `PartialEq` derives on all enums
- `Result<T, E>` with `?` propagation

### C#

- PascalCase for methods and properties
- Nullable reference types enabled
- PascalCase DB columns and enum values
- Pattern matching preferred over type casting

---

## 19. Blank Line Rules — Quick Reference

| Scenario | Blank Line? |
|----------|-------------|
| Before `return`/`throw` preceded by code | ✅ Yes |
| Before `return`/`throw` as only statement | ❌ No |
| After closing `}` | ✅ Yes (unless next line is `if`/`else`/`}`) |
| At start of function body | ❌ Never |
| Inside single-statement braces | ❌ Never |
| Double blank lines anywhere | ❌ Never |

---

## 20. Nesting Resolution Patterns

**Source:** `01-cross-language/20-nesting-resolution-patterns.md`

Three methods to flatten nested code:

1. **Extract to Named Function** — Pull inner logic into a descriptively named helper
2. **Inverse Logic (Early Return)** — Negative case exits first, happy path continues flat
3. **Named Boolean Variables** — Decompose compound conditions into named booleans

For deeply nested code (Level 4+), combine all three methods:
1. Identify exit conditions → extract guard cases
2. Name intermediate booleans
3. Extract helper functions
4. Use early returns → flatten remaining logic

---

## 21. Validation

Run `linter-scripts/validate-guidelines.py` — zero **CODE-RED** or **STYLE** violations required for all contributions.

---

## 22. TypeScript Standards

**Source:** `02-typescript/` (16 files including 7 enum specs, type-safety remediation, ESLint enforcement, discriminated-union patterns, promise/await patterns)

### 22.1 Strict Typing — Required `tsconfig.json` Flags

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

- **Forbidden:** `any`, `as` casts (except `as const`), `!` non-null assertion, `// @ts-ignore`.
- **Required:** explicit return types on all exported functions; named `interface`/`type` for every union variant (no inline literal unions in public APIs).

### 22.2 Discriminated Unions — Named Variants

```ts
// ❌ FORBIDDEN — inline variant
type Action = { type: 'load' } | { type: 'save'; data: string };

// ✅ REQUIRED — named interface per variant
interface LoadAction { type: 'Load' }
interface SaveAction { type: 'Save'; data: string }
type Action = LoadAction | SaveAction;
```

Each variant interface gets its own JSDoc and is independently exportable. Discriminator key is always `type` (PascalCase string values).

### 22.3 Promise / Await Patterns

- Every `Promise` must be `await`ed or explicitly returned. Floating promises are a CODE-RED.
- No `.then()` chains in application code — use `async`/`await` exclusively.
- Wrap network/IO awaits in try/catch only at the **boundary**; propagate `Result<T>` shaped errors internally.

### 22.4 Enum Pattern (TypeScript)

TypeScript enums use **string-valued objects with `as const`** plus a derived union type. **Never** use `enum` keyword (banned for tree-shaking + ambiguity reasons).

```ts
export const ConnectionStatus = {
  Connected: 'Connected',
  Disconnected: 'Disconnected',
  Reconnecting: 'Reconnecting',
} as const;
export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus];

export function parseConnectionStatus(v: unknown): ConnectionStatus {
  if (typeof v === 'string' && v in ConnectionStatus) return v as ConnectionStatus;
  throw new Error(`Invalid ConnectionStatus: ${String(v)}`);
}
```

Every project enum must ship: `parseX`, `isX`, and an exhaustive `X.values()` helper. See §4 of `04-enum-standards.md` for the full pattern.

### 22.5 ESLint Enforcement

Required rules (non-negotiable): `@typescript-eslint/no-explicit-any: error`, `no-floating-promises: error`, `no-misused-promises: error`, `consistent-type-imports: error`, `no-unsafe-*` family: error.

---

## 23. Go Standards

**Source:** `03-golang/` (13 files: enum specification, boolean standards, HTTPMethod enum, defer rules, string/slice internals, code-severity taxonomy, pathutil/fileutil spec, full standards reference split into 6 modules)

### 23.1 File & Function Size

| Limit | Value |
|-------|-------|
| File size | ≤ 300 lines (hard limit) |
| Function size | 8–15 lines target, 30 line ceiling |
| Cyclomatic complexity | ≤ 10 per function |
| Nesting depth | 0 nested `if` (zero-nesting CODE-RED) |

### 23.2 Error Handling — `apperror.Result[T]`

Go does **not** use the dual-return `(T, error)` pattern in this codebase. Every fallible function returns `apperror.Result[T]`:

```go
func LoadConfig(path string) apperror.Result[Config] {
    data, err := os.ReadFile(path)
    if err != nil {
        return apperror.Err[Config](apperror.Wrap(err).
            WithCode(apperror.E1001ConfigRead).
            WithContext("path", path))
    }
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return apperror.Err[Config](apperror.Wrap(err).
            WithCode(apperror.E1002ConfigParse).
            WithContext("path", path))
    }
    return apperror.Ok(cfg)
}
```

Result invariants: `result.HasError()` checked at every call site; `result.Unwrap()` panics if `HasError()` — only use after a guard.

### 23.3 Enum Pattern (Go) — Byte-Based with JSON Marshal

Every enum is its own file in an enum-specific subfolder, declared as a **byte-typed constant** with mandatory `String()`, `MarshalJSON()`, `UnmarshalJSON()`, `Parse()`, and `Values()` methods.

```go
package status

type Status byte

const (
    StatusUnknown  Status = 0
    StatusPending  Status = 1
    StatusComplete Status = 2
    StatusFailed   Status = 3
)

func (s Status) String() string { /* switch */ }
func (s Status) MarshalJSON() ([]byte, error) { return json.Marshal(s.String()) }
func (s *Status) UnmarshalJSON(b []byte) error { /* parse string → byte */ }
func ParseStatus(v string) (Status, error) { /* exhaustive switch */ }
func StatusValues() []Status { return []Status{StatusPending, StatusComplete, StatusFailed} }
```

JSON wire form is always the **PascalCase string value**, never the byte. See `03-golang/01-enum-specification/` for the full template.

### 23.4 Defer Rules

- One `defer` per resource, declared **immediately after** acquisition.
- Never `defer` inside a loop — extract to a helper function.
- `defer` must call a function that itself returns `apperror.Result` or logs via the session logger; never silently discard close errors.

### 23.5 Boolean Standards (Go-Specific)

- Positive guards only: `isReady()`, `hasItems()`, `canRetry()`. **No** `notReady`, `disabled`, `blocked`.
- Boolean **flag parameters are forbidden** — split into two methods (`Connect()` vs `ConnectVerbose()`).
- `if` conditions: max 2 operands. Compose with named booleans for ≥ 3.

### 23.6 Forbidden Go Patterns

| ❌ Pattern | ✅ Replacement |
|----------|---------------|
| `panic()` in production code | Return `apperror.Result[T]` |
| `(T, error)` dual return | `apperror.Result[T]` |
| Magic strings/numbers | Named constants in a dedicated `const` block |
| `interface{}` / `any` | Concrete types or generics with constraints |
| Bare `os.Open` without defer Close | Use `pathutil`/`fileutil` wrappers |
| Nested `if err != nil` chains | Guard returns + early exit |

### 23.7 `golangci-lint` Enforcement

Required linters: `errcheck`, `govet`, `staticcheck`, `gocyclo` (max 10), `gocognit`, `funlen` (60 stmts / 30 lines), `nestif` (max 1), `wrapcheck`, `revive`. Configuration lives in `.golangci.yml` at repo root.

---

## 24. PHP Standards

**Source:** `04-php/` (12 files: enums, forbidden patterns, naming, response array standard, spacing/imports, response key inventory, PHP↔Go consistency audit, full standards reference)

### 24.1 PHP Version & Style

- **PHP 8.1+ required** for backed enums, readonly properties, named arguments, `match` expressions.
- PSR-12 coding style with project overrides: PascalCase array keys, no underscores in identifiers, strict types declaration mandatory (`declare(strict_types=1);` on every file).

### 24.2 Enum Pattern (PHP) — Backed String Enums

```php
<?php
declare(strict_types=1);

enum ConnectionStatus: string
{
    case Connected    = 'Connected';
    case Disconnected = 'Disconnected';
    case Reconnecting = 'Reconnecting';

    public static function parse(string $v): self
    {
        return self::tryFrom($v)
            ?? throw new \InvalidArgumentException("Invalid ConnectionStatus: {$v}");
    }

    public static function values(): array
    {
        return array_map(fn ($c) => $c->value, self::cases());
    }
}
```

Every PHP enum must define: `parse()` (throws on invalid), `values()` (string array). Backing values are **always PascalCase strings**, never integers.

### 24.3 Response Envelope (PHP REST Handlers)

Every REST endpoint returns the universal envelope (PascalCase keys) via `EnvelopeBuilder`:

```php
return EnvelopeBuilder::ok($data)
    ->withMeta(['RequestId' => $requestId])
    ->build();

// Or on error:
return EnvelopeBuilder::error(ErrorCode::E2001ValidationFailed)
    ->withDetail('Field "Email" is required')
    ->build();
```

No handler may return raw arrays or call `wp_send_json()` directly.

### 24.4 `safeExecute()` Wrapper

Every public-facing REST handler is wrapped:

```php
public function handleRequest(\WP_REST_Request $req): \WP_REST_Response
{
    return $this->safeExecute(fn () => $this->doWork($req));
}
```

`safeExecute()` catches `\Throwable`, logs via `FileLogger` with 6-frame backtrace, and returns the standard error envelope. Plain try/catch is forbidden in handlers.

### 24.5 Forbidden PHP Patterns

| ❌ Pattern | ✅ Replacement |
|-----------|---------------|
| `extract()` | Explicit array access |
| `eval()` | Never — security CODE-RED |
| `@` error suppression | Proper try/catch with logging |
| `global $wpdb` in classes | Inject via constructor |
| String concatenation in SQL | `$wpdb->prepare()` always |
| `array_merge` in hot loops | Use `+=` operator or pre-allocated array |
| Magic `__call` / `__get` in app code | Explicit methods |

### 24.6 PHP↔Go Consistency

The PHP delegated server and Go backend share the **same response envelope schema** and the **same error code registry**. Any new error code must be registered in both languages simultaneously (see `03-error-manage/03-error-code-registry/`).

---

## 25. Rust Standards

**Source:** `05-rust/` (10 files: naming, error handling, async patterns, memory safety, testing, FFI/platform)

### 25.1 Identifiers — RFC 430 (snake_case)

Rust is the **only** language in the project that uses snake_case identifiers; this is non-negotiable per `rustfmt` and Clippy. **Database names and enum string discriminants remain PascalCase** for cross-language consistency.

### 25.2 Error Handling — `Result<T, AppError>`

- `unwrap()` and `expect()` are **forbidden** in non-test code (Clippy `unwrap_used = deny`).
- Use `?` operator with a project `AppError` enum that implements `From<std::io::Error>`, `From<serde_json::Error>`, etc.
- Every public fn returning `Result` must document the error variants in its `///` doc comment.

### 25.3 Async Patterns

- Tokio is the canonical runtime. `async-std` is forbidden.
- `.await` only at boundaries; internal helpers stay sync where possible to keep stack traces shallow.
- Cancellation safety: any `select!` branch must be cancel-safe or wrapped in `tokio::spawn`.

### 25.4 Memory Safety

- `unsafe` blocks require: a `// SAFETY:` comment justifying every invariant, a unit test exercising the unsafe path, and reviewer sign-off.
- No `Box::leak`, no `mem::transmute` without an FFI justification, no `static mut`.

### 25.5 Testing Standards

- `#[cfg(test)]` modules colocated with source.
- Property-based tests via `proptest` for parsers and codecs.
- `cargo nextest run` is the canonical runner; CI must use it (faster + better isolation than `cargo test`).

### 25.6 FFI / Platform

- C ABI exports use `#[no_mangle] pub extern "C"` with `*const c_char` / `*mut c_void` signatures only.
- All FFI allocations must round-trip through a matched `free` exported from the same crate.
- Windows-specific code lives in `src/platform/windows/`; Unix in `src/platform/unix/`. No `#[cfg(...)]` scattering in business logic.

---

## 26. AI Optimization

**Source:** `06-ai-optimization/` (5 files: anti-hallucination rules, AI quick-reference checklist, common AI mistakes, condensed master guidelines, enum naming quick reference)

### 26.1 Anti-Hallucination Rules (30+ rules, IDs `AH-N1`…)

Each rule names a specific pattern AI must **never** generate, paired with the required replacement and a link to the canonical spec it enforces. Examples:

| Rule | Forbidden | Required |
|------|-----------|----------|
| AH-N1 | `(T, error)` Go return | `apperror.Result[T]` |
| AH-N2 | `enum` keyword in TS | `as const` object + derived type |
| AH-N5 | snake_case JSON keys | PascalCase keys everywhere except Rust identifiers |
| AH-N9 | `unwrap()` in Rust prod code | `?` propagation |
| AH-N12 | `panic()` in Go prod code | Return error result |

The full rule list is the source of truth — when generating any code block, scan the rules for that language.

### 26.2 AI Quick-Reference Checklist (50 checks)

Run before emitting code: file size, function size, boolean prefix, no negations, enum methods present, no magic strings, error wrapped with code+context, log includes file path, etc. Machine-parseable as `- [ ]` checkboxes in `02-ai-quick-reference-checklist.md`.

### 26.3 Common AI Mistakes (top 15, before/after)

Real mistakes observed in AI-generated PRs, each with a corrected version. Highest-frequency: missing `apperror` wrap, inline union types, swallowed errors via `_`, magic numbers in retry counts, forgetting `defer` close on file handles.

### 26.4 Enum Naming Quick Reference

Cross-language table mapping declaration → naming → usage → validation for Go, TypeScript, PHP. See §22.4, §23.3, §24.2 above for the per-language patterns.

---

## 27. CI/CD Integration (Coding-Side)

**Source:** `06-cicd-integration/` (8 files: SARIF contract, plugin model, language roadmap, CI templates, distribution, rules mapping, performance, FAQ, troubleshooting)

This subfolder governs how **coding-standard violations** flow into CI:

| File | Purpose |
|------|---------|
| `01-sarif-contract.md` | Every linter must emit SARIF 2.1.0 with `ruleId`, `level`, `locations`, `message` |
| `02-plugin-model.md` | Linter plugin contract: stdin = file list, stdout = SARIF JSON |
| `04-ci-templates.md` | Reusable GitHub Actions workflow templates per language |
| `06-rules-mapping.md` | Mapping of guideline rule IDs → linter rule IDs (golangci-lint, ESLint, PHPStan, Clippy) |
| `07-performance.md` | Linter must complete in ≤ 60 s for 100k LOC; cache aggressively |

CI must **fail the build** on any CODE-RED severity finding; STYLE findings are warnings unless explicitly promoted in the repository's `.lint-policy.json`.

---

## 28. C# Standards

**Source:** `07-csharp/` (4 files: naming/conventions, method design, error handling, type safety)

### 28.1 Naming

- PascalCase for types, methods, properties, constants. camelCase for local variables and parameters.
- File names match the primary type: `UserProfile.cs` contains `class UserProfile`.
- Async methods suffixed `Async`: `LoadAsync()`, `SaveAsync()`.

### 28.2 Method Design

- One responsibility per method; same 8–15 line target as Go.
- Out parameters forbidden — return a tuple or a typed result record.
- Optional parameters preferred over method overloads when defaults are obvious.

### 28.3 Error Handling

- `try/catch` only at boundaries (HTTP handlers, message consumers).
- Internal failures use a `Result<T, AppError>` record (struct) — same shape as Go/Rust.
- Never swallow exceptions; either re-throw with context or convert to `Result.Err`.

### 28.4 Type Safety

- Nullable reference types enabled (`<Nullable>enable</Nullable>` in csproj).
- No `dynamic`, no `object` parameter types in public APIs.
- Records preferred over classes for DTOs; sealed by default.

---

## 29. File & Folder Naming (Cross-Language)

**Source:** `08-file-folder-naming/` (5 files: cross-language, PHP/WordPress, Go, TS/JS, Rust/C#)

### 29.1 Folder Naming Rule

- All spec and source folders: **lowercase-kebab-case with two-digit numeric prefix** (`01-foo-bar/`).
- Numeric prefixes are **unique** within a parent folder. Gaps are allowed (e.g., `01`, `03`, `05`).
- Reserved prefixes: `00-overview.md`, `97-acceptance-criteria.md`, `98-changelog.md`, `99-consistency-report.md` per folder.

### 29.2 Per-Language File Naming Summary

| Language | File Convention | Example |
|----------|----------------|---------|
| Go | snake_case | `deploy_path.go`, `user_repository_test.go` |
| TypeScript / JavaScript | kebab-case | `user-profile.tsx`, `auth-service.ts` |
| PHP (classes) | PascalCase matching class | `FileLogger.php` |
| PHP (WP main file) | kebab-case matching slug | `my-plugin.php` |
| Rust | snake_case | `deploy_path.rs` |
| C# | PascalCase | `UserProfile.cs` |
| PowerShell | lowercase-kebab-case | `run-validator.ps1` |
| Markdown specs | numeric-prefix kebab-case | `02-boolean-principles.md` |

---

## 30. PowerShell Integration

**Source:** `09-powershell-integration/` (cross-references to `spec/11-powershell-integration/` for the runtime)

The coding-side guidance is thin: PowerShell scripts that are **part of the build/CI pipeline** must follow `spec/11-powershell-integration/` (covered in `10-powershell-integration.md` consolidated file). For coding rules, only PascalCase Verb-Noun function naming and lowercase-kebab-case file naming apply.

---

## 31. Coding Research Placement

**Source:** `10-research/` — empirical studies and benchmarks specific to coding rules.

Place research files here when the deliverable is a **decision that updates a coding rule** (e.g., "should we ban `interface{}` in Go?" → benchmark + memo). Otherwise, project-wide research goes to root `spec/10-research/` (covered in `12-root-research.md`).

---

## 32. Security & Dependency Pinning

**Source:** `11-security/` — currently scoped to dependency version control.

### 32.1 Axios Pinning Rule

- **Allowed:** Axios `1.14.0` or `0.30.3` exactly.
- **Blocked:** Axios `1.14.1`, `0.30.4` (known regressions logged in memory).
- `package.json` must use exact versions (no `^` or `~`) for security-critical packages.

### 32.2 General Dependency Hygiene

- `npm audit` / `cargo audit` / `govulncheck` must report zero high/critical findings before merge.
- Lockfiles (`package-lock.json`, `bun.lock`, `Cargo.lock`, `go.sum`) are committed and never hand-edited.
- Adding a new dependency requires a one-line justification in the PR description.

---

## 33. App-Specific Coding Specs

**Source:** `21-app/`, `22-app-issues/`, `23-app-db/`, `24-app-ui-design-system/`

These four subfolders mirror the root-level `spec/21-app/` … `spec/24-app-ui-design-system/` folders but contain **coding-specific** rules that only apply to the application layer (not the framework). They are intentionally minimal — most rules live in the cross-language section.

| Subfolder | What goes here | What does NOT |
|-----------|---------------|---------------|
| `21-app/` | App feature code style overrides | Feature requirements (those go in root `spec/21-app/`) |
| `22-app-issues/` | Bug-driven coding rule additions | Issue tickets (those go in root `spec/22-app-issues/`) |
| `23-app-db/` | App-specific schema patterns | Generic DB rules (those go in `spec/04-database-conventions/`) |
| `24-app-ui-design-system/` | App component coding patterns | Design tokens (those live in root `spec/07-design-system/`) |

If a rule applies to **all** apps the team builds, it belongs in `01-cross-language/` instead.

---

## Cross-References

| Topic | Full Spec Location |
|-------|-------------------|
| Boolean Principles (P1–P8) | `02-coding-guidelines/01-cross-language/02-boolean-principles/` |
| No Raw Negations | `01-cross-language/12-no-negatives.md` |
| PascalCase Keys | `01-cross-language/11-key-naming-pascalcase.md` |
| Variable Naming | `01-cross-language/22-variable-naming-conventions.md` |
| Function Naming | `01-cross-language/10-function-naming.md` |
| Code Style (7 files) | `01-cross-language/04-code-style/` |
| Strict Typing | `01-cross-language/13-strict-typing.md` |
| Magic Values | `01-cross-language/26-magic-values-and-immutability.md` |
| DRY Principles | `01-cross-language/08-dry-principles.md` |
| Slug Conventions | `01-cross-language/28-slug-conventions.md` |
| Casting Elimination | `01-cross-language/03-casting-elimination-patterns.md` |
| Generic Return Types | `01-cross-language/25-generic-return-types.md` |
| Cyclomatic Complexity | `01-cross-language/06-cyclomatic-complexity.md` |
| SOLID Principles | `01-cross-language/23-solid-principles.md` |
| Null Pointer Safety | `01-cross-language/19-null-pointer-safety.md` |
| Code Mutation Avoidance | `01-cross-language/18-code-mutation-avoidance.md` |
| Lazy Evaluation | `01-cross-language/16-lazy-evaluation-patterns.md` |
| Regex Guidelines | `01-cross-language/17-regex-usage-guidelines.md` |
| Test Naming & Structure | `01-cross-language/14-test-naming-and-structure.md` |
| Types Folder Convention | `01-cross-language/27-types-folder-convention.md` |
| Nesting Resolution | `01-cross-language/20-nesting-resolution-patterns.md` |
| Master Coding Guidelines | `01-cross-language/15-master-coding-guidelines/` |
| Enum Standards | `../17-consolidated-guidelines/04-enum-standards.md` |
| Boolean Flag Methods | `01-cross-language/24-boolean-flag-methods.md` |

---


---

## §34 Validator Inventory — All 16 Linter Assets

This section is the **single canonical reference** for every validator enforced by CI. A blind AI must consult this table before writing code, modifying specs, or bumping dependencies. Skipping any of these will fail the pipeline.

### 34.1 Active Linter Scripts

| # | Asset | Type | Purpose | Config Consumed | Exit Codes | Example Invocation |
|---|-------|------|---------|-----------------|------------|--------------------|
| 1 | `linter-scripts/validate-guidelines.py` | Python | Code-Red metrics: zero-nesting, max 2 operands, function 8–15 lines, file < 300 lines, React component < 100 lines | (in-script thresholds) | `0` pass · `1` violation found · `2` config error | `python3 linter-scripts/validate-guidelines.py --root .` |
| 2 | `linter-scripts/validate-guidelines.go` | Go | Native port of #1 — runs on platforms without Python | (in-binary thresholds) | `0` pass · `1` violation · `2` IO error | `go run linter-scripts/validate-guidelines.go --root .` |
| 3 | `linter-scripts/check-spec-cross-links.py` | Python | Verifies every internal markdown link resolves to a real file/anchor | `linter-scripts/spec-cross-links.allowlist` | `0` pass · `1` broken link | `python3 linter-scripts/check-spec-cross-links.py --root spec --repo-root .` |
| 4 | `linter-scripts/check-spec-folder-refs.py` | Python | Verifies every `spec/NN-folder/` reference points to a real folder OR is allowlisted under `[external]` / `[doc-only]` | `linter-scripts/spec-folder-refs.allowlist` | `0` pass · `1` stale reference | `python3 linter-scripts/check-spec-folder-refs.py` |
| 5 | `linter-scripts/check-axios-version.sh` | Bash | Enforces axios pinning: blocks `1.14.1` and `0.30.4`; allows only `1.14.0` and `0.30.3` | `package.json` | `0` pass · `1` blocked version found | `bash linter-scripts/check-axios-version.sh` |
| 6 | `linter-scripts/check-forbidden-strings.py` | Python | Scans repo for forbidden tokens (legacy names, deprecated APIs, sensitive markers) | `linter-scripts/forbidden-strings.toml` | `0` pass · `1` forbidden token found | `python3 linter-scripts/check-forbidden-strings.py` |
| 7 | `linter-scripts/check-forbidden-spec-paths.sh` | Bash | Blocks creation of legacy/deprecated spec folder paths | (hard-coded list) | `0` pass · `1` forbidden path | `bash linter-scripts/check-forbidden-spec-paths.sh` |
| 8 | `linter-scripts/suggest-spec-cross-link-fixes.py` | Python | Auto-suggests fixes for broken cross-links produced by #3 | `linter-scripts/spec-cross-links.allowlist` | `0` always (advisory) | `python3 linter-scripts/suggest-spec-cross-link-fixes.py` |
| 9 | `linter-scripts/generate-dashboard-data.cjs` | Node | Produces `spec/dashboard-data.json` consumed by the docs viewer | `version.json`, `spec/**/*.md` | `0` pass · non-zero on IO error | `node linter-scripts/generate-dashboard-data.cjs` |
| 10 | `linter-scripts/run.sh` | Bash | Orchestrator — runs all linters in sequence on Unix | (delegates) | `0` all pass · first non-zero from any child | `bash linter-scripts/run.sh` |
| 11 | `linter-scripts/run.ps1` | PowerShell | Orchestrator — Windows equivalent of #10 | (delegates) | `0` all pass · first non-zero | `pwsh linter-scripts/run.ps1` |
| 17 | `linter-scripts/check-memory-mirror-drift.py` | Python | Detects drift between `.lovable/memory/index.md` Core section and §X mirror in `21-lovable-folder-structure.md` (presence check on 21 distinctive tokens) | `.lovable/memory/index.md`, `spec/17-consolidated-guidelines/21-lovable-folder-structure.md` | `0` no drift · `1` drift detected · `2` structural error | `python3 linter-scripts/check-memory-mirror-drift.py` |

### 34.2 Configuration Files

| # | Asset | Format | Purpose | Edit Mode |
|---|-------|--------|---------|-----------|
| 12 | `linter-scripts/forbidden-strings.toml` | TOML | Defines forbidden tokens, scope globs, and per-token rationale | Hand-edit; commit triggers #6 |
| 13 | `linter-scripts/spec-cross-links.allowlist` | Plain-text (one path per line) | Allows links to files outside the spec tree (e.g., `README.md`, `LICENSE`) | Hand-edit |
| 14 | `linter-scripts/spec-folder-refs.allowlist` | Sectioned text (`[external]`, `[doc-only]`) | Allows references to non-existent or sibling-repo folders | Hand-edit |
| 15 | `linter-scripts/installer-templates/` | Directory | Versioned `install.sh` / `install.ps1` templates used by release pipeline | Hand-edit per release |
| 16 | `linter-scripts/README-cross-links.md` | Markdown | Operator guide for cross-link allowlist editing | Hand-edit |

### 34.3 Allowlist Syntax — `spec-folder-refs.allowlist`

```
[external]
# Sibling-repo references — owner/repo or relative paths outside this spec tree
spec/15-domain-migration/
spec/legacy-archive/

[doc-only]
# Folders that exist only as documentation pointers, not real spec folders
spec/folder-structure-root.md
```

**Resolution rule:** `check-spec-folder-refs.py` exits non-zero with `Stale references found` if a markdown file references a `spec/NN-name/` path that:
1. Does not exist on disk, AND
2. Is not listed under `[external]` or `[doc-only]`.

### 34.4 Allowlist Syntax — `spec-cross-links.allowlist`

```
# One path per line, relative to repo root. Glob not supported.
README.md
LICENSE
.github/CODEOWNERS
```

### 34.5 Forbidden-Strings Schema — `forbidden-strings.toml`

```toml
[[forbidden]]
token = "github.com/mahin/movie-cli"          # bare v1 reference
reason = "v1 namespace is deprecated; always use movie-cli-v2"
scope = ["**/*.go", "**/*.md"]
severity = "error"

[[forbidden]]
token = "console.log("
reason = "Use logger.info / logger.debug instead"
scope = ["src/**/*.ts", "src/**/*.tsx"]
severity = "error"
exclude = ["**/*.test.ts"]
```

### 34.6 Mandatory CI Order

The orchestrator scripts (#10/#11) run linters in this order. **Do not re-order** — later linters depend on earlier linters' invariants:

```
1. validate-guidelines.py        (code metrics — fastest, fail-fast)
2. check-axios-version.sh        (dependency pinning)
3. check-forbidden-strings.py    (token scanner)
4. check-forbidden-spec-paths.sh (spec-path guard)
5. check-spec-cross-links.py     (markdown link integrity)
6. check-spec-folder-refs.py     (folder-reference integrity)
7. generate-dashboard-data.cjs   (artifact regeneration — last)
8. check-memory-mirror-drift.py  (memory↔mirror parity — informational)
```

### 34.7 Failure Recovery Quick-Reference

| CI Error | Likely Cause | Fix |
|----------|--------------|-----|
| `Stale references found` | Markdown links to a deleted/renamed spec folder | Either fix the link, OR add to `[external]`/`[doc-only]` in `spec-folder-refs.allowlist` |
| `Drift detected in version.json` | Forgot to run sync after editing `package.json` or specs | Run `node scripts/sync-version.mjs && node scripts/sync-spec-tree.mjs` and commit |
| `missing-file: <path>` | Markdown link to a file that does not exist | Create the file, fix the link, or add to `spec-cross-links.allowlist` |
| `forbidden token found` | Used a string from `forbidden-strings.toml` | Replace with the suggested alternative in the rule's `reason` field |
| `axios version blocked` | Bumped to `1.14.1` or `0.30.4` | Pin to `1.14.0` or `0.30.3` exactly |
| `validate-guidelines: function too long` | Function > 15 lines | Split per Code-Red metrics: 8–15 lines per function |
| `memory-mirror-drift: token X not found` | Edited `mem://index.md` Core section without updating §X mirror | Update §X in `21-lovable-folder-structure.md` to include the new rule, OR remove the obsolete token from `EXPECTED_TOKENS` in `check-memory-mirror-drift.py` |

### 34.8 AI Pre-Flight Checklist

Before opening a PR, a blind AI must run **all 7** orchestrated linters locally:

```bash
# Unix
bash linter-scripts/run.sh

# Windows
pwsh linter-scripts/run.ps1

# After spec edits, also:
node scripts/sync-version.mjs
node scripts/sync-spec-tree.mjs
```

If any linter exits non-zero, **do not push**. Fix or allowlist (with justification in commit message), then re-run.

---

*Validator Inventory added — v3.3.0 — 2026-04-22*
