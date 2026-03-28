# flip / reverseArgs

`flip(fn)` creates a new function that swaps the first two arguments of the original function. `reverseArgs(fn)` creates a new function that reverses the order of all arguments.

## Use Cases

- **Argument reordering**: Adapt functions to match expected callback signatures
- **Function composition**: Change the order of arguments for better pipeline compatibility
- **Mathematical operations**: Swap operands for operations like subtraction and division

## Key Advantages

### Type Safety
- **Compile-time validation**: TypeScript validates that the function has at least 2 parameters and no rest parameters
- **Parameter name preservation**: The resulting function preserves meaningful parameter names

### Optional Parameter Support
- **Handles optional parameters**: Correctly handles functions with optional first or second parameters

## API

```typescript
// Swap the first two arguments
function flip<F>(fn: ValidFlipFn<F>): Flip<F>;

// Reverse all arguments
function reverseArgs<F>(fn: ValidFlipFn<F>): ReverseArgs<F>;
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `F` | The function to flip arguments for. Must have at least 2 parameters. Cannot have rest parameters. |

### Return Value

- `flip`: A new function with the first two arguments swapped
- `reverseArgs`: A new function with all arguments in reverse order

### Type Constraints

The following cases are prohibited by the type system:

- **Zero or one parameter**: The function must have at least 2 parameters
- **Rest parameters**: Functions with rest parameters cannot be flipped (flipping rest parameters has unclear semantics)

## Usage Examples

### flip - Basic Usage

```typescript
const subtract = (a: number, b: number) => a - b;
const flipped = flip(subtract);

subtract(5, 3);   // 2
flipped(5, 3);    // -2 (equivalent to subtract(3, 5))
```

### flip with Optional Parameters

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];
const flipped = flip(fn);

// Original: a is required, b is optional
// Flipped: b comes first (still optional), a comes second
flipped(42, 'hello');  // ['hello', 42, undefined]
flipped(undefined, 'hello', true);  // ['hello', undefined, true]
```

### flip with pipe

```typescript
const divide = (a: number, b: number) => a / b;
const flippedDivide = flip(divide);

// Create a "divide by 2" function
const halve = (x: number) => flippedDivide(x, 2);

[10, 20, 30].map(halve);  // [5, 10, 15]
```

### reverseArgs - Basic Usage

```typescript
const fn = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
const reversed = reverseArgs(fn);

fn('hello', 42, true);        // "hello-42-true"
reversed(true, 42, 'hello');  // "hello-42-true"
```

### reverseArgs with More Parameters

```typescript
const format = (day: number, month: string, year: number, format: string) =>
  `${day} ${month} ${year} (${format})`;

const reversed = reverseArgs(format);

// Original order: day, month, year, format
// Reversed order: format, year, month, day
reversed('ISO', 2024, 'Jan', 15);  // "15 Jan 2024 (ISO)"
```

## Important Notes

1. **At Least 2 Parameters**: The function must have at least 2 parameters
   ```typescript
   const unary = (x: number) => x;
   // flip(unary);  // Type error: function must have at least 2 parameters
   ```

2. **No Rest Parameters**: Functions with rest parameters cannot be flipped
   ```typescript
   const fn = (a: number, b: number, ...rest: string[]) => ...;
   // flip(fn);  // Type error: rest parameters not supported
   ```

3. **Parameter Names**: The resulting function preserves parameter names. For `flip`, the first two parameter names are swapped.

4. **This Context**: The `this` context is preserved

5. **Optional Parameters**: Both functions correctly handle optional parameters, preserving their optionality in the result
