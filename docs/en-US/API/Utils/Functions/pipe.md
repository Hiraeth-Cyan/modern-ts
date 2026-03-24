# pipe

`pipe(...fns)` or `pipeAsync(...fns)` creates a function pipeline that composes multiple functions from left to right, where the output of each function becomes the input of the next. `run` and `runAsync` are used for immediate pipeline execution.

## Use Cases

In data processing workflows (such as data transformation, validation chains, middleware processing), the pipeline mechanism clearly expresses the order of data flow, avoiding nested callback hell and improving code readability and maintainability.

## Key Advantages

### Precise Type Inference
- **Chain Type Checking**: TypeScript validates that each function's input/output types match at compile time, displaying clear error messages when types don't match
- **Automatic Final Type Inference**: Automatically infers the final return type based on the function chain without manual annotation

### Intelligent Async Handling
- **Sync-First**: `runAsync` and `pipeAsync` execute synchronously as much as possible, only switching to async mode when encountering the first `Promise`
- **Seamless Mixing**: Supports mixing synchronous and asynchronous functions in the same pipeline, automatically handling Promise unpacking and propagation

### Flexible Invocation Methods
- **`run` / `runAsync`**: Execute the pipeline immediately with an initial value and function list
- **`pipe` / `pipeAsync`**: Create reusable curried functions with deferred execution

## API

### Synchronous Pipeline

```typescript
// Execute immediately
function run<T, Fns extends readonly [NextFn<any, any>, ...NextFn<any, any>[]]>(
  input: T,
  ...fns: Fns
): Out<Fns>;

// Create pipeline function
function pipe(): IdentityFn;
function pipe<Fns extends readonly [Fn<any, any>, ...NextFn<any, any>[]]>(
  ...fns: Fns
): PipeR<Fns>;
```

### Asynchronous Pipeline

```typescript
// Execute immediately
function runAsync<T, Fns extends [AsyncNextFn<any, any>, ...AsyncNextFn<any, any>[]]>(
  input: T,
  ...fns: Fns
): Promise<AsyncOut<Fns>>;

// Create pipeline function
function pipeAsync(): IdentityFn;
function pipeAsync<Fns extends readonly [AsyncFn<any, any>, ...AsyncNextFn<any, any>[]]>(
  ...fns: Fns
): AsyncPipeR<Fns>;
```

## Parameter Reference

### pipe / pipeAsync Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fns` | `Function[]` | List of functions to compose |

### run / runAsync Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `input` | `T` | Initial input value |
| `fns` | `Function[]` | List of functions to execute |

### Return Values

| Function | Return Value |
| -------- | ------------ |
| `pipe(...fns)` | Composed synchronous function |
| `pipeAsync(...fns)` | Composed async-compatible function, returns `Promise` |
| `run(input, ...fns)` | Synchronous pipeline execution result |
| `runAsync(input, ...fns)` | Async pipeline execution result, returns `Promise` |

## Usage Examples

### Basic Usage

```typescript
const addOne = (x: number) => x + 1;
const double = (x: number) => x * 2;
const toString = (x: number) => `Result: ${x}`;

// Use pipe to create a reusable function
const transform = pipe(addOne, double, toString);

console.log(transform(5));  // "Result: 12"

// Use run for immediate execution
const result = run(5, addOne, double, toString);
console.log(result);  // "Result: 12"
```

### Multi-Argument Functions

```typescript
// The first function can accept multiple arguments
const sum = (a: number, b: number) => a + b;
const multiplyByThree = (x: number) => x * 3;
const format = (x: number) => `Value is ${x}`;

const compute = pipe(sum, multiplyByThree, format);

console.log(compute(2, 3));  // "Value is 15"
```

### Async Pipeline

```typescript
const fetchUser = async (id: number) => {
  return {id, name: 'Alice', age: 25};
};

const extractName = (user: {name: string}) => user.name;
const toUpperCase = (name: string) => name.toUpperCase();

// Create async pipeline
const getUpperCaseName = pipeAsync(fetchUser, extractName, toUpperCase);

// Execute and await result
const result = await getUpperCaseName(1);
console.log(result);  // "ALICE"

// Or use runAsync
const result2 = await runAsync(1, fetchUser, extractName, toUpperCase);
console.log(result2);  // "ALICE"
```

### Mixing Sync and Async

```typescript
const syncAdd = (x: number) => x + 1;
const asyncDouble = async (x: number) => x * 2;
const syncToString = (x: number) => `Value: ${x}`;

// Sync and async functions can be mixed
const mixed = pipeAsync(syncAdd, asyncDouble, syncToString);

// Automatically switches to Promise mode after encountering async function
const result = await mixed(5);
console.log(result);  // "Value: 12"
```

### Type Error Detection

```typescript
const toString = (x: number) => `${x}`;
const toNumber = (x: string) => parseInt(x, 10);
const double = (x: number) => x * 2;

// Type error: toString returns string, but double expects number
// const invalid = pipe(toString, double);
//     ^^^^^ Compile error: type mismatch

// Correct order
const valid = pipe(toNumber, double);
console.log(valid("5"));  // 10
```

### Empty Pipeline (Identity Function)

```typescript
// Returns identity function when no arguments provided
const identity = pipe();
console.log(identity(42));  // 42

const asyncIdentity = pipeAsync();
console.log(asyncIdentity(42));  // 42
```

### Using with curry

```typescript
const multiply = (a: number, b: number) => a * b;
const add = (a: number, b: number) => a + b;

const curriedMultiply = curry(multiply, 2);
const curriedAdd = curry(add, 2);

// Create partial functions
const double = curriedMultiply(__, 2);
const addTen = curriedAdd(__, 10);

// Use in pipeline
const transform = pipe(double, addTen);
console.log(transform(5));  // 20 (5 * 2 + 10)
```

## Important Notes

1. **First Function Specialness**: The first function in a pipeline can accept multiple arguments; subsequent functions must accept exactly one argument (receiving the previous function's output)

2. **Async Return Values**: `pipeAsync` and `runAsync` return `Promise` when encountering async functions, even if subsequent functions are synchronous

3. **Error Propagation**: Any error in the pipeline (sync throw or Promise rejection) interrupts execution and propagates upward

4. **Type Inference Limitations**:
   - Pipeline function type inference depends on the length of the function array
   - Very long function chains may slow down type inference
   - Recommend splitting into multiple pipelines in complex scenarios
