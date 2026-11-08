process.env.AUTH_SECRET ??= 'test-secret-key-at-least-thirty-two-characters-long';
// The suite runs against a dedicated database created by tests/global-setup.ts.
process.env.DATABASE_URL = 'file:./test.db';
process.env.UPLOAD_DIR ??= './storage/uploads';
process.env.MAX_UPLOAD_MB ??= '8';
