/**
 * Resolves Playwright and a Chromium build.
 *
 * Playwright is a peer tool rather than a project dependency, so the browser
 * suites can run against an existing installation. Install it with
 * `npm i -D playwright` or point PLAYWRIGHT_MODULE at an existing install.
 */
async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/opt/node-tools/node_modules/playwright/index.js',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(
    'Playwright was not found. Install it with "npm i -D playwright", or set '
      + 'PLAYWRIGHT_MODULE to the path of an existing installation.',
  );
}

export async function launchBrowser(options = {}) {
  const chromium = await loadPlaywright();
  return chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    ...options,
  });
}

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/** Collects results and prints them as it goes. */
export function createRecorder() {
  const results = [];
  return {
    results,
    record(name, ok, detail = '') {
      results.push({ name, ok, detail });
      console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    },
    get failures() {
      return results.filter((r) => !r.ok).length;
    },
    summarise(errors = []) {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - failed}/${results.length} checks passed.`);
      if (errors.length > 0) {
        console.log(`\nPage errors and 5xx responses (${errors.length}):`);
        for (const e of [...new Set(errors)].slice(0, 20)) console.log(`  - ${e}`);
      }
      return failed === 0 && errors.length === 0;
    },
  };
}
