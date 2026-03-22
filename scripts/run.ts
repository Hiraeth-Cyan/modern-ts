// ========================================
// ./scripts/run.ts
// ========================================
import {execSync} from 'node:child_process';
import path from 'node:path';

const target_file = process.argv[2];

if (!target_file) {
  console.error('没有找到文件路径');
  process.exit(1);
}

const is_test = target_file.endsWith('.spec.ts');
const is_bench = target_file.includes('__benchmark__');

const project_root = process.cwd();
const relative_path = path
  .relative(project_root, target_file)
  .replace(/\\/g, '/');

const source_file = relative_path.replace('.spec.ts', '.ts');

const command = is_test
  ? `pnpm vitest run "${relative_path}" --coverage --coverage.include="${source_file}"`
  : `pnpm vite-node "${relative_path}"`;

try {
  const env = is_bench
    ? {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --expose-gc`,
      }
    : process.env;

  execSync(command, {stdio: 'inherit', env});
} catch (e) {
  if (is_test) {
    console.error('测试失败');
  } else {
    console.error('运行错误:\n', e);
  }

  process.exit(1);
}
