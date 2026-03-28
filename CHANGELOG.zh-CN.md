# 更新日志

## [0.8.3] - 2026-03-28

### 新增
- 增强了`curry`函数的类型推导：
  - 检测移到了逆变位，调用`curry`时就会报错，而不是使用返回值时报错。并且明确禁止了单参数、指定长度为1、重复柯里化、指定长度大于参数数量、指定长度不是正整数的情况
  - 增强了可选值的处理，现在可选值不再强制其为必选，而是可以传undefined（对于默认参数，传undefined会使用默认值）
  - 优化了类型系统计算量，现在更高效
- 增强了`ary`函数的类型推导，支持参数名保留、剩余参数、可选参数，检测能力和`curry`函数相当。同时增加了`binary`、`trinary`函数作为别名
- 增强了`partialRight`函数的类型推导，现在支持参数名保留、可选参数，禁止剩余参数（rest 参数在末尾且长度无限，从右边开始无法被固定）
- 优化了`expectIdentical`的类型，现在不会被`never`类型欺骗了
- 新增`expectAssignableStrict`函数，用于严格检查类型是否可赋值给另一个类型，排除`never`和`any`类型
- 新增`flip`/`reverseArgs`函数，用于翻转函数的参数顺序。支持参数名保留、可选参数、禁止剩余参数（翻转剩余参数语义不明）
- 新增`IsPositiveIntegerLiteral`、`IsNonNegativeIntegerLiteral`、`IsIntegerLiteral`、`IsLiteralNumber`，用于约束数字字面量

### 变更
- 将`ary`/`partial`/`partialRight`从`Utils/Functions/base.ts`中独立，并添加了完善的类型测试
- `memoize`改为了策略模式
- 合并`defer`到`Utils/Functions/base.ts`
- 给`fetchQ`用上了ALS并发测试

## [0.8.2] - 2026-03-25

### 新增
- 增加了更多文档
- 优化了`attempt`、`rest`、`partial`、`partialRight`、`unary`函数的类型定义
- 增强了`curry`函数的对可选值的类型处理/增加了对剩余参数的处理

### 修复
- 修复了 README 文档中的描述错误。
- 修复了 `Fit` 类 `toShaped` 方法字段校验不生效的问题
- 修复了 `unary`、`negate`、`once`、`ary`、`rest`、`spread`、`partial`、`partialRight`、`after`、`before`、`memoize` 函数的this丢失的问题
- 修复了typedoc文档生成问题

### 变更
- 将`pace`模块移动至`Utils/Function`模块
