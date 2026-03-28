# curry

`curry(fn, length)` creates a curried function that supports step-by-step argument application and placeholder (`__`) functionality for flexible partial function application.

## Use Cases

- **Creating Configurable Function Variants**: Pre-fill some arguments to generate specialized functions
- **Function Composition**: Work with `pipe` to create reusable data processing pipelines
- **Deferred Execution**: Control when the function actually executes

## Key Advantages

### Placeholder Support
- **Flexible Argument Filling**: Use `__` placeholders to skip certain arguments and fill them in later
- **Non-Sequential Argument Passing**: No need to pass arguments in order, increasing code flexibility

### Precise Type Control
- **Type Safety**: TypeScript validates argument types at compile time
- **Intelligent Hints**: Each step of the call provides accurate type hints and autocomplete
- **Early Error Detection**: Type errors are reported at the call site rather than when using the return value

### Explicit Arity Control
- **Custom Argument Count**: Explicitly specify how many arguments need to be collected before executing the original function via the `length` parameter
- **Handling Default Parameters**: Suitable for functions with default values to avoid premature execution

## API

```typescript
// Create a curried function
function curry<F extends AnyFunction, N extends number>(
  fn: ValidCurryFn<F>,
  length: ValidLengthForFn<F, N>
): Curry<F, N> & CurryBrand;

// Placeholder symbol
const __: unique symbol;
type __ = typeof __;
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `F` | The original function to curry. Must have at least 2 parameters. Cannot be already curried. Cannot have rest parameters. |
| `length` | `N` | The number of arguments to collect (positive integer literal); the original function executes when this count is reached. Must be <= the number of function parameters. |

### Return Value

- If the number of provided arguments (excluding placeholders) reaches `length`, returns the result of executing the original function
- Otherwise, returns a new curried function awaiting more arguments

### Type Constraints

The following cases are prohibited by the type system and will report errors at the call site:

- **Single-parameter functions**: Currying is meaningless for functions with only 1 parameter
- **Zero-parameter functions**: Cannot curry functions with no parameters
- **Length = 1**: Specifying length as 1 is not allowed
- **Already curried functions**: Cannot curry a function that has already been curried
- **Length > parameter count**: The specified length cannot exceed the number of function parameters
- **Non-literal length**: Length must be a positive integer literal, not a `number` type variable
- **Rest parameters**: Functions with rest parameters (`...args`) cannot be curried

## Usage Examples

### Basic Usage

```typescript
const add = (a: number, b: number, c: number) => a + b + c;

// Create curried version, specifying 3 arguments needed
const curriedAdd = curry(add, 3);

// Pass all arguments at once
console.log(curriedAdd(1, 2, 3));  // 6

// Step-by-step calls
console.log(curriedAdd(1)(2)(3));  // 6

// Mixed calls
console.log(curriedAdd(1, 2)(3));  // 6
console.log(curriedAdd(1)(2, 3));  // 6
```

### Using Placeholders

```typescript
const formatMessage = (prefix: string, message: string, suffix: string) => 
  `${prefix}: ${message} ${suffix}`;

const curriedFormat = curry(formatMessage, 3);

// Skip arguments using placeholders
const withPrefix = curriedFormat('INFO', __);
console.log(withPrefix('Hello')('!'));  // "INFO: Hello !"

// Fill later arguments first
const withSuffix = curriedFormat(__, __, '!');
console.log(withSuffix('ERROR')('Failed'));  // "ERROR: Failed !"

// Multiple placeholders
const fillMiddle = curriedFormat('DEBUG', __, '.');
console.log(fillMiddle('Running'));  // "DEBUG: Running ."
```

### Creating Specialized Functions

```typescript
const calculate = (base: number, rate: number, discount: number) => 
  base * rate * (1 - discount);

const curriedCalc = curry(calculate, 3);

// Create functions with specific configurations
const standardRate = curriedCalc(__, 1.2);
const vipDiscount = standardRate(__, 0.2);

console.log(vipDiscount(100));  // 96 (100 * 1.2 * 0.8)

// Alternative configuration
const premiumRate = curriedCalc(__, 1.5, 0);
console.log(premiumRate(100));  // 150 (100 * 1.5 * 1)
```

### Using with pipe

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

### Handling Async Functions

```typescript
const fetchWithConfig = async (url: string, method: string, body: object) => {
  // Simulate API call
  return {url, method, body};
};

const curriedFetch = curry(fetchWithConfig, 3);

// Create pre-configured API client
const apiClient = curriedFetch('https://api.example.com');
const postToApi = apiClient('POST');

// Final call
const result = await postToApi({name: 'Alice'});
console.log(result);
// { url: 'https://api.example.com', method: 'POST', body: { name: 'Alice' } }
```

### Handling Functions with Default Parameters

```typescript
function withDefaults(a: number, b: number = 10, c: number = 20) {
  return a + b + c;
}

// Only require 1 argument
const curried1 = curry(withDefaults, 1);
console.log(curried1(5));  // 35 (5 + 10 + 20)

// Require 3 arguments
const curried3 = curry(withDefaults, 3);
console.log(curried3(5)(6)(7));  // 18 (5 + 6 + 7)
console.log(curried3(5, 6, 7));  // 18

// Optional parameters can be passed as undefined to use defaults
const curried2 = curry(withDefaults, 2);
console.log(curried2(5, undefined));  // 35 (5 + 10 + 20), b uses default
```

## Important Notes

1. **Required `length` Parameter**: You must explicitly specify the number of arguments to collect
   ```typescript
   // Error: length must be a positive integer literal
   curry(add, 0);  // Type error
   curry(add, -1); // Type error
   curry(add, 1);  // Type error: length must be >= 2
   ```

2. **Placeholder Replacement Rules**:
   - New arguments fill existing placeholders first
   - Remaining arguments are appended to the argument list
   - New placeholders are also appended to the argument list

3. **Type Safety**:
   - Empty argument calls are blocked by the type system
   - Type mismatches are reported at compile time
   - Errors are reported at the call site (contravariant position detection)

4. **Execution Timing**:
   - The original function executes when `argument count - placeholder count >= length`
   - Placeholders are replaced with `undefined` before being passed to the original function

5. **Type System Limitations**:
   - **Variadic Functions**: Cannot curry functions with rest parameters (`...args`)
     ```typescript
     const sumAll = (...args: number[]) => args.reduce((a, b) => a + b, 0);
     // curry(sumAll, 3) will produce a type error
     ```
   
   - **Length Must Be Literal**: Cannot use variables of type `number`
     ```typescript
     const n = 3;  // Type is number
     // curry(add, n) will produce a type error
     
     curry(add, 3);  // Correct: use numeric literal
     ```
   
   - **Zero-Parameter Functions**: Currying functions with no parameters is meaningless
     ```typescript
     const noArgs = () => 42;
     // curry(noArgs, 0) will produce a type error
     ```
   
   - **Already Curried**: Cannot curry a function that has already been curried
     ```typescript
     const curried = curry(add, 3);
     // curry(curried, 2) will produce a type error
     ```

6. **This Context**:
   - Currying preserves `this` context binding
