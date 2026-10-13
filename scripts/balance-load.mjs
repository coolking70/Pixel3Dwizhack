import { createServer } from 'vite';
export async function loadBalance() {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  try {
    const runner = await server.ssrLoadModule('/src/balance/runner.ts');
    const report = await server.ssrLoadModule('/src/balance/report.ts');
    return { ...runner, ...report, close: () => server.close() };
  } catch (error) { await server.close(); throw error; }
}
