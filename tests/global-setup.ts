/**
 * Creates and seeds a dedicated test database before the suite runs, so the
 * integration tests are repeatable and never touch development data.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve(process.cwd(), 'prisma/test.db');
const DATABASE_URL = 'file:./test.db';

export default async function globalSetup() {
  for (const suffix of ['', '-journal']) {
    rmSync(`${TEST_DB}${suffix}`, { force: true });
  }

  const env = {
    ...process.env,
    DATABASE_URL,
    AUTH_SECRET: 'test-secret-key-at-least-thirty-two-characters-long',
    UPLOAD_DIR: './storage/uploads',
  };

  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env, stdio: 'pipe',
  });
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], { env, stdio: 'pipe' });
}
