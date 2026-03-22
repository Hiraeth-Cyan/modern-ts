// ========================================
// ./__benchmark__/helper.ts
// ========================================

import {ensureError} from '../src/unknown-error';

// ============================================
// GC Configuration
// ============================================

export let gcEnabled = false;

try {
  if (typeof global.gc === 'function') {
    gcEnabled = true;
    console.log('✅ GC enabled');
  } else {
    console.log('⚠️  GC unavailable, please run Node.js with --expose-gc flag');
  }
} catch (error) {
  console.log('⚠️  Unable to check GC status');
}

// -- GC Helper Function --

export function runGC() {
  if (gcEnabled) {
    try {
      global.gc!();
      global.gc!();
      global.gc!();
      return true;
    } catch (error) {
      console.error('⚠️  GC execution failed:', ensureError(error));
      return false;
    }
  }
  return false;
}

// ============================================
// Byte Conversion Utilities
// ============================================

const ByteUnit = 1024;
const MaxMbSize = ByteUnit * ByteUnit;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return 'NaN';
  if (bytes === 0) return '0 B';

  const sign = bytes < 0 ? '-' : '';
  const absBytes = Math.abs(bytes);

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(ByteUnit));

  const value = absBytes / Math.pow(ByteUnit, i);
  return `${sign}${i === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

export function mbToBytes(mb: number): number {
  return mb * MaxMbSize;
}

export function getHeapBytes(): number {
  return process.memoryUsage().heapUsed;
}

// ============================================
// Memory Monitor
// ============================================

export class MemoryMonitor {
  public readonly samples: number[] = [];
  public readonly labels: string[] = [];

  snapshot(label: string) {
    const mem = getHeapBytes();
    this.samples.push(mem);
    this.labels.push(label);
  }

  renderChart(width = 40, height = 5): string {
    if (this.samples.length < 2) return 'Insufficient data for chart';

    const min = Math.min(...this.samples);
    const max = Math.max(...this.samples);
    const range = max - min || 1;

    const normalized = this.samples.map((v) =>
      Math.round(((v - min) / range) * (height - 1)),
    );

    const lines: string[] = [];

    for (let y = height - 1; y >= 0; y--) {
      let line = '';
      for (let x = 0; x < normalized.length; x++) {
        line += normalized[x] >= y ? '█' : ' ';
      }
      line = line.padEnd(width, ' ');

      const val = min + (range / (height - 1)) * y;
      lines.push(`${formatBytes(val).padStart(10)} │${line}`);
    }

    lines.push('           └' + '─'.repeat(width));

    const info = this.labels.map((l, i) => `[${i}]${l}`).join(' -> ');
    return `${lines.join('\n')}\nLegend: ${info}`;
  }
}
