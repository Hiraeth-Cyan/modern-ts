# partial

`partial(fn, ...fixedArgs)` creates a function that invokes `fn` with `fixedArgs` prepended to the arguments provided to the new function.

## Use Cases

- **Pre-configuring functions**: Create specialized versions of functions by pre-filling some arguments
- **Function composition**: Prepare functions for use in pipelines by fixing certain parameters
- **Callback adaptation**: Adapt functions to match expected callback signatures

## Key Advantages

### Type Safety
- **Full type inference**: TypeScript correctly infers the types of remaining arguments
- **Parameter order validation**: Ensures fixed arguments match the beginning of the function's parameter list

### Flexible Application
- **Any number of fixed arguments**: Can fix one or more arguments from the start
- **Preserves `this` context**: The `this` context is properly preserved

## API

```typescript
function partial<
  This,
  Fixed extends readonly [unknown, ...unknown[]],
  Rest extends readonly unknown[],
  Ret,
>(
  fn: (this: This, ...args: [...Fixed, ...Rest]) => Ret,
  ...fixedArgs: Fixed
): (this: This, ...rest: Rest) => Ret;
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `Function` | The function to partially apply arguments to |
| `...fixedArgs` | `Fixed` | The arguments to prepend. Must fix at least one argument. |

### Return Value

A new function that accepts the remaining arguments and invokes the original function with the fixed arguments prepended.

## Usage Examples

### Basic Usage

```typescript
const greet = (greeting: string, name: string, punctuation: string) =>
  `${greeting}, ${name}${punctuation}`;

// Fix the first argument
const sayHello = partial(greet, 'Hello');
sayHello('World', '!');  // 'Hello, World!'

// Fix the first two arguments
const sayHelloToAlice = partial(greet, 'Hello', 'Alice');
sayHelloToAlice('!');  // 'Hello, Alice!'
```

### Creating Specialized Functions

```typescript
const calculate = (operation: string, a: number, b: number) => {
  switch (operation) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    default: throw new Error('Unknown operation');
  }
};

// Create specialized functions
const add = partial(calculate, 'add');
const multiply = partial(calculate, 'multiply');

add(5, 3);        // 8
multiply(5, 3);   // 15
```

### With Array Methods

```typescript
const multiply = (factor: number, value: number) => value * factor;

// Create a "double" function
const double = partial(multiply, 2);

[1, 2, 3, 4].map(double);  // [2, 4, 6, 8]
```

### Preserving This Context

```typescript
const obj = {
  prefix: 'Hello',
  greet(name: string) {
    return `${this.prefix}, ${name}!`;
  }
};

const boundGreet = partial(obj.greet.bind(obj));
// Or use call/apply with the partial function
```

## Important Notes

1. **At Least One Fixed Argument**: You must fix at least one argument
   ```typescript
   partial(fn);  // Type error: must provide at least one fixed argument
   ```

2. **Order Matters**: Fixed arguments are prepended in the order they are provided, matching the function's parameter order
   ```typescript
   const fn = (a: number, b: string, c: boolean) => ...;
   
   // Correct: fixes a=1
   partial(fn, 1);
   
   // Incorrect: 1 is not assignable to string
   // partial(fn, 'hello');
   ```

3. **Type Inference**: TypeScript will infer the types of remaining arguments based on the fixed arguments

4. **This Context**: The `this` context is preserved. Use `bind` if you need to fix the `this` value as well
