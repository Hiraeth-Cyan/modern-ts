# ary / unary / binary / trinary

`ary(fn, n)` creates a function that invokes `fn` with only the first `n` arguments provided. Arguments beyond `n` are discarded and not passed to `fn`. `unary`, `binary`, and `trinary` are convenience wrappers for `ary(fn, 1)`, `ary(fn, 2)`, and `ary(fn, 3)` respectively.

## Use Cases

- **Fixing callback functions**: Ensure callback functions receive the correct number of arguments (e.g., fixing `parseInt` in `Array.map`)
- **Function composition**: Control the arity of functions when composing pipelines
- **API adaptation**: Adapt functions to match expected callback signatures

## Key Advantages

### Parameter Name Preservation
- **Named parameters retained**: The resulting function preserves the original parameter names for better IDE support

### Optional Parameter Support
- **Handles optional parameters**: Correctly handles functions with optional parameters

### Rest Parameter Support
- **Works with rest parameters**: Can limit the number of arguments passed to functions with rest parameters

### Type Safety
- **Compile-time validation**: TypeScript validates the arity at compile time
- **Literal number constraint**: The `n` parameter must be a literal number, not a variable

## API

```typescript
// Limit function to n arguments
function ary<F extends AnyFunction, N extends number>(
  fn: ValidAryFn<F>,
  n: ValidAryN<F, N>
): Ary<F, N>;

// Convenience wrappers
function unary<F extends AnyFunction>(fn: ValidAryFn<F>): Ary<F, 1>;
function binary<F extends AnyFunction>(fn: ValidAryFnOf<F, 2>): Ary<F, 2>;
function trinary<F extends AnyFunction>(fn: ValidAryFnOf<F, 3>): Ary<F, 3>;
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `F` | The function to limit arguments for. Must have at least one parameter. |
| `n` | `N` | The number of arguments to accept. Must be a non-negative integer literal. For fixed-length functions, must be <= the number of parameters. |

### Return Value

A new function that accepts only the first `n` arguments and passes them to the original function.

### Type Constraints

The following cases are prohibited by the type system:

- **Zero-parameter functions**: The function must have at least one parameter
- **Non-literal n**: `n` must be a literal number, not a `number` type variable
- **Non-integer n**: `n` must be a non-negative integer literal
- **n > parameter count**: For fixed-length functions, `n` cannot exceed the number of parameters

## Usage Examples

### Basic Usage

```typescript
const fn = (a: string, b: number, c: boolean) => [a, b, c];

// Limit to 2 arguments
const limited = ary(fn, 2);
limited('hello', 42);  // ['hello', 42, undefined]

// Extra arguments are ignored
limited('hello', 42, true, 'extra');  // ['hello', 42, undefined]
```

### Fixing parseInt in map

The classic use case for `unary` is fixing `parseInt` which accepts a radix as its second argument:

```typescript
// Without unary - wrong results due to index being passed as radix
['1', '2', '3'].map(parseInt);  // [1, NaN, NaN]

// With unary - correct results
['1', '2', '3'].map(unary(parseInt));  // [1, 2, 3]

// Equivalent to
['1', '2', '3'].map(ary(parseInt, 1));  // [1, 2, 3]
```

### Using binary and trinary

```typescript
const add = (a: number, b: number, c: number, d: number) => a + b + c + d;

// Accept only first 2 arguments
const add2 = binary(add);
add2(1, 2);        // 3 (c and d are undefined)

// Accept only first 3 arguments
const add3 = trinary(add);
add3(1, 2, 3);     // 6 (d is undefined)
```

### Working with Optional Parameters

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];

// Limit to 2 arguments (preserves optionality)
const limited = ary(fn, 2);
limited('hello');        // ['hello', undefined, undefined]
limited('hello', 42);    // ['hello', 42, undefined]
```

### Working with Rest Parameters

```typescript
const fn = (a: string, ...rest: number[]) => [a, rest];

// Limit to 2 arguments (1 fixed + 1 from rest)
const limited = ary(fn, 2);
limited('hello', 1, 2, 3);  // ['hello', [1]] (only first rest arg kept)
```

### Chaining ary

```typescript
const fn = (a: string, b: number, c: boolean, d: string) => [a, b, c, d];

// Can compose ary calls
const composed = ary(ary(fn, 3), 1);
composed('hello');  // ['hello', undefined, undefined, undefined]
```

## Important Notes

1. **Literal Number Required**: The `n` parameter must be a literal number, not a variable
   ```typescript
   const count = 2;
   // ary(fn, count);  // Type error: count is not a literal
   
   ary(fn, 2);  // Correct
   ```

2. **Parameter Name Preservation**: The returned function preserves the original parameter names for better IDE support

3. **Optional Parameters**: When limiting to a point that includes optional parameters, they remain optional in the resulting function

4. **Runtime Validation**: While the type system enforces constraints at compile time, runtime validation also ensures `n` is a non-negative integer

5. **This Context**: The `this` context is preserved when calling the limited function
