import { defineConfig } from 'vitest/config';
import { availableParallelism } from 'node:os';
// Bound heavyweight deterministic route workers instead of oversubscribing
// every logical CPU. Assertions and per-test time budgets remain unchanged.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], maxWorkers: Math.min(4, availableParallelism()) } });
