import { defineConfig, devices } from '@playwright/test';

// Smoke E2E runs against the Vite dev server. WebGL in headless Chromium uses
// SwiftShader, which is enough to prove the pipeline renders visible color.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !(globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.CI,
    timeout: 60_000,
  },
});
