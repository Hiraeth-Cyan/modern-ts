# partialRight

`partialRight(fn, ...fixedArgs)` creates a function that invokes `fn` with `fixedArgs` appended to the arguments provided to the new function.

## Use Cases

- **Pre-configuring trailing arguments**: Create specialized versions of functions by pre-filling arguments from the right
- **Function composition**: Prepare functions for use in pipelines by fixing trailing parameters
- **Callback adaptation**: Adapt functions to match expected callback signatures when trailing arguments are known

## Key Advantages

### Type Safety
- **Full type inference**: TypeScript correctly infers the types of remaining arguments
- **Parameter order validation**: Ensures fixed arguments match the end of the function's parameter list
- **Rest parameter detection**: Prohibits functions with rest parameters (since rest parameters at the end have infinite length and cannot be fixed from the right)

### Parameter Name Preservation
- **Named parameters retained**: The resulting function preserves the original parameter names for better IDE support

### Optional Parameter Support
- **Handles optional parameters**: Correctly handles functions with optional parameters

## API

```typescript
function partialRight<
  T extends AnyFunction,
  Fixed extends readonly [unknown, ...unknown[]],
>(
  fn: AtLeastOneParams<T>,
  ...fixedArgs: ValidFixedForRight<Parameters<T>, Fixed>
): (
  this: ThisParameterType<T>,
  ...rest: ExtractRest<Parameters<T>, Fixed>
) => ReturnType<T>;
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `T` | The function to partially apply arguments to. Must have at least one parameter. Cannot have rest parameters. |
| `...fixedArgs` | `Fixed` | The arguments to append. Must fix at least one argument. Passed in declaration order. |

### Return Value

A new function that accepts the remaining arguments and invokes the original function with the fixed arguments appended.

### Type Constraints

The following cases are prohibited by the type system:

- **Zero-parameter functions**: The function must have at least one parameter
- **Rest parameters**: Functions with rest parameters cannot use partialRight (rest parameters at the end have infinite length)
- **Mismatched types**: Fixed arguments must match the types of the trailing parameters

## Usage Examples

### Basic Usage

```typescript
const format = (name: string, action: string, target: string) =>
  `${name} ${action} ${target}`;

// Fix the last two arguments (passed in declaration order)
const ranToStore = partialRight(format, 'ran to', 'the store');
ranToStore('Alice');  // 'Alice ran to the store'

// Fix the last argument
const calculate = (a: number, b: number, c: number, d: number) => a + b + c + d;
const addSeven = partialRight(calculate, 3, 4);
addSeven(1, 2);  // 10 (1 + 2 + 3 + 4)
```

### Creating Event Handlers

```typescript
const logEvent = (eventType: string, timestamp: number, message: string) =>
  `[${timestamp}] ${eventType}: ${message}`;

// Pre-configure event type and timestamp formatter
const logError = partialRight(logEvent, 'ERROR', Date.now());
logError('Connection failed');  // '[1234567890] ERROR: Connection failed'
```

### With Optional Parameters

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];

// Fix optional parameters
const fixed = partialRight(fn, 42, true);
fixed('hello');  // ['hello', 42, true]
```

## Important Notes

1. **Arguments in Declaration Order**: Pass fixed arguments in the same order they appear in the function signature, not in reverse
   ```typescript
   const fn = (a: number, b: string, c: boolean) => ...;
   
   // Correct: fixes b='hello', c=true
   partialRight(fn, 'hello', true);
   
   // Incorrect: 'hello' is not assignable to boolean
   // partialRight(fn, true, 'hello');
   ```

2. **No Rest Parameters**: Functions with rest parameters cannot use partialRight
   ```typescript
   const fn = (a: number, ...rest: string[]) => ...;
   // partialRight(fn, 'x');  // Type error: rest parameters not supported
   ```

3. **At Least One Fixed Argument**: You must fix at least one argument
   ```typescript
   partialRight(fn);  // Type error: must provide at least one fixed argument
   ```

4. **This Context**: The `this` context is preserved

5. **Parameter Names**: The resulting function preserves the original parameter names for better IDE support
