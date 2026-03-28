// ============================================
// ./scripts/run.ts
// ============================================
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const target_file = process.argv[2];

if (!target_file) {
  console.error('没有找到文件路径');
  process.exit(1);
}

// -- 判定逻辑 --
const is_type_test = target_file.endsWith('.test-d.ts');
const is_spec_test = target_file.endsWith('.spec.ts');
const is_bench = target_file.includes('__benchmark__');

const project_root = process.cwd();
const relative_path = path
  .relative(project_root, target_file)
  .replace(/\\/g, '/');

// -- 命令构建 --
let command = '';
let temp_config_path: string | undefined;

if (is_type_test) {
  // 创建临时 tsconfig，继承主配置，只检查单个文件
  // 放在项目根目录下，以便正确解析 types 和 paths
  temp_config_path = path.join(project_root, '.tsconfig-type-test.json');
  const temp_config = {
    extends: './tsconfig.json',
    files: [relative_path],
    include: [relative_path],
  };
  fs.writeFileSync(temp_config_path, JSON.stringify(temp_config, null, 2));
  command = `pnpm tsc --project "${temp_config_path}" --noEmit --incremental false --pretty false`;
} else if (is_spec_test) {
  const source_file = relative_path.replace('.spec.ts', '.ts');
  command = `pnpm vitest run "${relative_path}" --coverage --coverage.include="${source_file}" --typecheck.enabled=false`;
} else {
  command = `pnpm vite-node "${relative_path}"`;
}

try {
  const env = is_bench
    ? {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --expose-gc`,
      }
    : process.env;

  execSync(command, {stdio: 'inherit', env});
} catch (e) {
  if (is_spec_test || is_type_test) console.error('测试失败了');
  else console.error('运行错误:\n', e);

  process.exit(1);
} finally {
  // 清理临时 tsconfig 文件
  if (temp_config_path) fs.unlinkSync(temp_config_path);
}
