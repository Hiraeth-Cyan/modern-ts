# modern-ts

<div align="center">

**A Modern TypeScript Standard Suite**

Self-contained · Zero Dependencies · 100% Coverage · Tree-shakeable · High Performance

</div>

> ⚠️ **Beta Notice**: Currently in beta phase, collecting community feedback. API may undergo breaking changes at any time. Use with caution in production environments.

---

## Features

- **Self-contained**: No runtime dependencies, ready to use out of the box
- **Zero Dependencies**: Keeps the project lightweight, avoids supply chain risks
- **100% Coverage**: Comprehensive test coverage ensures code quality
- **Tree-shakeable**: Supports tree-shaking for on-demand imports
- **High Performance**: Key modules are deeply optimized, outperforming similar libraries

## Module Overview

### 🔄 Concurrent — Concurrency Primitives

A comprehensive collection of system-level concurrency primitives:

| Submodule     | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| **Lock**      | `Mutex`, `Semaphore`, `ConditionVariable`, `RwLock` and other concurrency locks |
| **Valve**     | `TokenBucket`, `LeakyBucket`, `SlidingWindow`, `CircuitBreaker` flow control    |
| **Limit**     | Concurrent task quantity control (more complete than `p-limit`)                 |
| **Channel**   | Go language CSP model implementation                                            |
| **Scheduler** | CFS-Like cooperative async scheduler                                            |
| **TaskScope** | Structured concurrency manager                                                  |

### ⏰ MockClock — Mock Clock

A mock clock based on `AsyncLocalStorage`, supports concurrent testing with deep simulation of `NodeJS.Timeout` handles.

### 🎭 Monad — Common Functional Primitives

| Module     | Purpose              |
| ---------- | -------------------- |
| **Result** | Error handling       |
| **Maybe**  | Optional values      |
| **Reader** | Dependency injection |

### 🛠️ Utils — Utility Functions

A comprehensive utility function library (similar to `lodash`):

- Type-safe `curry` / `pipe` (supports placeholders and deep inference)
- High-performance `debounce` / `throttle` (more robust edge handling than `lodash`)
- Deep copy `cloneDeep` (supports circular references, stack-based implementation, handles 100k+ nesting levels)
- Common type utilities, array, object, function, string, Map/Set utility functions

### 🌐 FetchQ — HTTP Client

A feature-rich HTTP client using the Result pattern.

### ✅ Fit — Schema Validation

A type-first, tree-shakeable, and highly extensible schema validation library.

### 📦 Other Modules

| Module           | Description                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Other**        | Common data structures (Deque, Heap, Queue, Stack, DisjointSet) and utility functions                                         |
| **Resource**     | RAII resource manager based on `using`                                                                                        |
| **Flow**         | Reactive stream (similar to RxJS) with inversion of control via consume method                                                |
| **EventEmitter** | Cross-platform EventEmitter with nearly identical behavior and superior performance metrics compared to Node.js native module |

## Installation

```bash
# pnpm
pnpm add modern-ts

# npm
npm install modern-ts

# yarn
yarn add modern-ts
```

## Quick Start

### Import Methods

The library supports multiple import methods:

```typescript
// Import all
import * as Modern from 'modern-ts';

// Import by namespace
import { Result, Maybe } from 'modern-ts';

// Subpath import (tree-shaking optimized)
import { Ok, Err } from 'modern-ts/Result';
import { Some, None } from 'modern-ts/Maybe';
import { Mutex } from 'modern-ts/Concurrent';
import { debounce, throttle } from 'modern-ts/Utils';
```

### Example: Result Error Handling

```typescript
import { Ok, Err, Result, isOk } from 'modern-ts/Result';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err('Division by zero');
  return Ok(a / b);
}

const result = divide(10, 2);
if (isOk(result)) {
  console.log(result.value); // 5
}
```

### Example: Fit Schema Validation

```typescript
import * as f from 'modern-ts/Fit';

interface User {
  name: string;
  age: number;
  tags: string[];
}

const UserSchema = f
  .fit<User | 'VIP'>()
  .off((v) => v === 'VIP', 'ok') // Short-circuit return 'ok' if VIP
  .toShaped({
    name: f.String().that(f.min_len(2)),
    age: f.Number().that(f.range(0, 150)),
    tags: f.items(f.String()),
    // Compilation error if fields don't match User
  });

const result = f.validate({name: 'Alice', age: 25, tags: ['dev']}, UserSchema);
/*
result.ok === true, result.value is the validated object with type:
"ok" | {
    name: string;
    age: number;
    tags: string[];
}
*/
```

### Example: MockClock Concurrent Time Simulation

```typescript
import { MockClock, runTimelineAsync } from 'modern-ts/VirtualTime';

// Concurrent testing: two independent timelines, isolated from each other
const clock1 = MockClock();
const clock2 = MockClock();

let t1: number;
let t2: number;

await Promise.all([
  withTimelineAsync(clock1, async () => {
    clock1.setSystemTime(1000); // Set start time
    t1 = Date.now(); // 1000
  }),
  withTimelineAsync(clock2, async () => {
    clock2.setSystemTime(2000); // Different start time
    t2 = Date.now(); // 2000
  }),
]);
// t1 === 1000, t2 === 2000 (timeline isolation)
```

### Example: Scheduler Cooperative Scheduling

```typescript
import { Scheduler } from 'modern-ts/Concurrent';

const scheduler = new Scheduler(1);
const log: string[] = [];

// Tasks yield control via pause() for cooperative scheduling
await Promise.all([
  scheduler.add(async (_, pause) => {
    log.push('A-start');
    await pause({ nice: 10 }); // Lower priority, yield execution
    log.push('A-resume');
  }),
  scheduler.add(() => log.push('B-run'), { nice: -5 }), // Higher priority
]);

// Execution order: A-start → B-run → A-resume
```

## Subpath Exports

| Path                    | Description                 |
| ----------------------- | --------------------------- |
| `modern-ts/Result`      | Result error handling       |
| `modern-ts/Maybe`       | Maybe optional values       |
| `modern-ts/Reader`      | Reader dependency injection |
| `modern-ts/ReaderT`     | Reader + Result             |
| `modern-ts/Resource`    | RAII resource management    |
| `modern-ts/TxScope`     | RAII transaction scope      |
| `modern-ts/Lazy`        | Lazy evaluation             |
| `modern-ts/FetchQ`      | HTTP client                 |
| `modern-ts/Fit`         | Schema validation           |
| `modern-ts/VirtualTime` | Virtual time                |
| `modern-ts/Concurrent`  | Concurrency primitives      |
| `modern-ts/Reactive`    | Reactive primitives         |
| `modern-ts/Utils`       | Utility functions           |
| `modern-ts/Arr`         | Array utilities             |
| `modern-ts/Str`         | String utilities            |
| `modern-ts/Sets`        | Set utilities               |
| `modern-ts/Maps`        | Map utilities               |

## API Documentation

For detailed API documentation, see the [docs/en](./docs/en) directory.

## Requirements

- Node.js >= 20
- TypeScript >= 5.0

## License

[Apache-2.0](./LICENSE)
