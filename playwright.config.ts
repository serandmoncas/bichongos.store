import { defineConfig, devices } from "@playwright/test";

// El puerto es configurable porque el 3000 puede estar ocupado por otra cosa
// en la máquina de quien corre los tests. Con reuseExistingServer, Playwright
// reutilizaría ese servidor ajeno y los tests fallarían con errores confusos
// ("Cannot GET /...") en vez de decir que el puerto no era el nuestro.
const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Borra los usuarios de prueba y sus datos al terminar. Sin esto la base
  // local —que sobrevive entre corridas— acumula usuarios sin límite y los
  // selectores de personas se vuelven tan pesados que los tests fallan por
  // timeout. Ver e2e/fixtures/teardown.ts.
  globalTeardown: "./e2e/fixtures/teardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE ?? "",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
