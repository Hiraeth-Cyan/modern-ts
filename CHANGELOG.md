# Changelog

## [0.8.2] - 2026-03-25

### Added
- 增加了更多文档
- 优化了`attempt`、`rest`、`partial`、`partialRight`、`unary`函数的类型定义
- 增强了`curry`函数的对可选值的类型处理/增加了对可变参数的处理

### Fixed
- 修复了 README 文档中的描述错误。
- 修复了 `Fit` 类 `toShaped` 方法字段校验不生效的问题
- 修复了 `unary`、`negate`、`once`、`ary`、`rest`、`spread`、`partial`、`partialRight`、`after`、`before`、`memoize` 函数的this丢失的问题
- 将`pace`模块移动至`Utils/Function`模块
- 修复了typedoc文档生成问题
