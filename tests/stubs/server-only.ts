/**
 * In Next.js the `server-only` package throws if a module is pulled into a
 * client bundle. Under Vitest there is no bundler boundary, so it is aliased
 * to this no-op to allow server modules to be unit tested directly.
 */
export {};
