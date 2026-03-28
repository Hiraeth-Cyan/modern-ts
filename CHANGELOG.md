# Changelog

## [0.8.3] - 2026-03-28

### Added
- Enhanced type inference for `curry` function:
  - Detection moved to contravariant position, errors reported when calling `curry` instead of when using return value. Explicitly prohibited: single argument, specified length of 1, repeated currying, length greater than parameter count, non-positive integer length
  - Enhanced optional parameter handling, optional parameters no longer forced to be required, can pass undefined (for default parameters, passing undefined uses default value)
  - Optimized type system computation, now more efficient
- Enhanced type inference for `ary` function, supporting parameter name preservation, rest parameters, and optional parameters, with detection capabilities comparable to `curry` function. Added `binary` and `trinary` functions as aliases
- Enhanced type inference for `partialRight` function, now supporting parameter name preservation and optional parameters, prohibiting rest parameters (rest parameters are at the end with infinite length, cannot be fixed from the right)
- Optimized `expectIdentical` type, now cannot be deceived by `never` type
- Added `expectAssignableStrict` function for strictly checking if a type is assignable to another type, excluding `never` and `any` types
- Added `flip`/`reverseArgs` function for reversing the order of function parameters. Supports parameter name preservation, optional parameters, prohibits rest parameters (flipping rest parameters has unclear semantics)
- Added `IsPositiveIntegerLiteral`, `IsNonNegativeIntegerLiteral`, `IsIntegerLiteral`, `IsLiteralNumber` for constraining numeric literals

### Changed
- Extracted `ary`/`partial`/`partialRight` from `Utils/Functions/base.ts` with comprehensive type tests
- Refactored `memoize` to use strategy pattern
- Merged `defer` into `Utils/Functions/base.ts`
- Applied ALS concurrent testing to `fetchQ`

## [0.8.2] - 2026-03-25

### Added
- Added more documentation
- Optimized type definitions for `attempt`, `rest`, `partial`, `partialRight`, and `unary` functions
- Enhanced `curry` function's type handling for optional values and added support for rest parameters

### Fixed
- Fixed description errors in README documentation
- Fixed field validation not working in `Fit` class's `toShaped` method
- Fixed `this` context loss in `unary`, `negate`, `once`, `ary`, `rest`, `spread`, `partial`, `partialRight`, `after`, `before`, and `memoize` functions
- Fixed TypeDoc documentation generation issues

### Changed
- Moved `pace` module to `Utils/Function` module
