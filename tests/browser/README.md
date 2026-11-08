# Browser test suites

Two suites drive the running application with a real browser, verifying that
every module is not only present but working.

| Suite | What it covers | Checks |
|---|---|---|
| `smoke.mjs` | Every public, applicant and administrative page; registration; a full draft application with document upload; role-based access for seven roles; unauthenticated access; report exports; responsive layout | 132 |
| `lifecycle.mjs` | A complete recruitment exercise driven through the UI by the officers who hold the rights for each stage — planning, approval, publication, registration, submission, document verification, screening, shortlisting, examination, interview, final selection, notification and archiving — then the applicant's view and the audit trail | 80 |

A third script, `screenshots.mjs`, is not a test: it captures every significant
screen for review packs, user acceptance testing and the manuals.

## Running them

They need a seeded database, a running server, and Playwright.

```bash
npm run db:reset
```

```bash
npm run build && npm start
```

```bash
npm i -D playwright
```

```bash
BASE_URL=http://localhost:3000 node tests/browser/smoke.mjs
```

```bash
BASE_URL=http://localhost:3000 node tests/browser/lifecycle.mjs
```

To capture the screens (44 PNGs, written to `./screens` by default):

```bash
BASE_URL=http://localhost:3000 OUT_DIR=./screens node tests/browser/screenshots.mjs
```

`lifecycle.mjs` creates its own recruitment exercise and applicants, so it can be
re-run without resetting the database. `smoke.mjs` reads its fixtures from the
seeded data and also registers one new applicant per run.

Both exit non-zero if any check fails, or if any page raises a script error or
returns a 5xx response.

### Environment

| Variable | Purpose |
|---|---|
| `BASE_URL` | The running portal. Defaults to `http://localhost:3000` |
| `PLAYWRIGHT_MODULE` | Path to an existing Playwright installation, if it is not a project dependency |
| `CHROMIUM_PATH` | Path to a Chromium binary, where Playwright's own download is not used |
| `OUT_DIR` | Where `screenshots.mjs` writes. Defaults to `./screens` |
| `STAFF_PASSWORD`, `APPLICANT_PASSWORD` | Seeded sign-in details, where they have been changed |
