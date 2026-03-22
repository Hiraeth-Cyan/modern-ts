// ========================================
// ./__benchmark__/Schema/bundle-size.ts
// ========================================
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import Table from 'cli-table3';

const outDir = path.resolve(__dirname, 'dist');

// 清理输出目录
if (fs.existsSync(outDir)) fs.rmSync(outDir, {recursive: true});
fs.mkdirSync(outDir, {recursive: true});

// ============================================
// 工具函数
// ============================================
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getGzipSize = (content: Buffer): number => {
  return zlib.gzipSync(content, {level: 6}).length;
};

// ============================================
// 构建与测量逻辑
// ============================================
interface BuildResult {
  name: string;
  minifiedSize: number;
  gzipSize: number;
}

const buildConfig = (
  name: string,
  entryPoint: string,
): esbuild.BuildOptions => ({
  entryPoints: [entryPoint],
  bundle: true,
  minify: true,
  outfile: path.join(outDir, `${name}.min.js`),
  format: 'esm',
  platform: 'browser',
  treeShaking: true,
  metafile: true,
  external: [],
});

async function buildAndMeasure(
  name: string,
  entry: string,
): Promise<BuildResult | null> {
  try {
    const config = buildConfig(name, entry);
    const result = await esbuild.build(config);

    if (!result.metafile) {
      throw new Error('Metafile not generated');
    }

    // 从 metafile 获取输出文件大小
    const outputFile = Object.keys(result.metafile.outputs)[0];
    const outputInfo = result.metafile.outputs[outputFile];

    // 读取文件内容用于 Gzip 计算
    const content = fs.readFileSync(outputFile);
    const gzipSize = getGzipSize(content);
    const minifiedSize = outputInfo.bytes;

    return {name, minifiedSize, gzipSize};
  } catch (error) {
    console.error(`\n❌ Error building ${name}:`, error);
    return null;
  }
}

// ============================================
// 主函数
// ============================================
async function main() {
  console.log('\n🚀 Schema Bundle Size Benchmark\n');

  const schemas = [
    {name: 'fit', entry: path.resolve(__dirname, 'fit-schema.ts')},
    {name: 'zod', entry: path.resolve(__dirname, 'zod-schema.ts')},
    {name: 'valibot', entry: path.resolve(__dirname, 'valibot-schema.ts')},
  ];

  const results: BuildResult[] = [];

  // 1. 依次构建，仅显示简洁进度
  for (const schema of schemas) {
    process.stdout.write(`Building ${schema.name}... `);
    const result = await buildAndMeasure(schema.name, schema.entry);
    if (result) {
      results.push(result);
      console.log('✓');
    } else {
      console.log('✗');
    }
  }

  if (results.length === 0) {
    console.log('No results to compare.');
    return;
  }

  // 2. 按 Gzip 大小排序
  const sortedResults = [...results].sort((a, b) => a.gzipSize - b.gzipSize);
  const smallestGzip = sortedResults[0].gzipSize;

  // 3. 使用 cli-table3 打印汇总表格
  console.log('\n📊 Summary Table');
  const table = new Table({
    head: ['Library', 'Minified', 'Gzipped', 'Ratio'],
    colWidths: [12, 12, 12, 10],
    colAligns: ['left', 'right', 'right', 'right'],
    style: {head: ['cyan']},
  });

  sortedResults.forEach((result) => {
    table.push([
      result.name,
      formatBytes(result.minifiedSize),
      formatBytes(result.gzipSize),
      `${(result.gzipSize / smallestGzip).toFixed(2)}x`,
    ]);
  });

  console.log(table.toString());

  // 4. 差距分析
  console.log('\n📈 Size Differences (Gzip)');
  console.log('-'.repeat(60));

  for (let i = 0; i < sortedResults.length - 1; i++) {
    const current = sortedResults[i];
    const next = sortedResults[i + 1];
    const diff = next.gzipSize - current.gzipSize;
    const percent = ((diff / current.gzipSize) * 100).toFixed(1);
    console.log(
      `  ${current.name} ➔ ${next.name}: +${formatBytes(diff)} (${percent}% larger)`,
    );
  }
  console.log('-'.repeat(60));
  console.log();
}

main().catch(console.error);
