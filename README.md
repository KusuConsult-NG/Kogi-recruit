# Kogi State Civil Service Commission Portal

With an integrated **Civil Service Recruitment Management System**.

Built to the specification in *Product Development and Deployment Proposal — Kogi State
Civil Service Commission Portal* (Edumanager Information System Ltd., 2 November 2026).

---

## What this is

A centralised digital platform for the Kogi State Civil Service Commission covering:

- the **public-facing portal** — institutional information, leadership, departments, news,
  circulars, public notices, recruitment announcements, downloads, FAQs and enquiries;
- the **applicant portal** — registration, profile, online applications, document upload and
  end-to-end application tracking;
- the **secure administrative backend** — recruitment administration, screening, document
  verification, examination and interview administration, final selection, reporting, user and
  role management, notifications and a complete audit trail.

Every one of the eight modules in the proposal is implemented. See
[`docs/REQUIREMENTS-TRACEABILITY.md`](docs/REQUIREMENTS-TRACEABILITY.md) for a clause-by-clause
map from the proposal to the code.

---

## Quick start

```bash
npm install
```

```bash
npm run setup
```

`npm run setup` generates the Prisma client, creates the database and loads seed data: the
Commission's departments and units, institutional pages, leadership profiles, FAQs, downloads,
news and notices, notification templates, system settings, one account for each of the ten staff
roles, and a complete sample recruitment exercise with 33 applicants spread across every stage of
the ten-stage workflow.

```bash
npm run dev
```

The portal is then available at <http://localhost:3000>.

### Development sign-in details

These accounts exist only in seed data. **Change or remove them before deployment.**

| Role | Email | Password |
|---|---|---|
| Super Administrator | `superadmin@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Commission Administrator | `commission.admin@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Recruitment Director / Coordinator | `recruitment.director@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Recruitment Officer | `recruitment.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Screening Officer | `screening.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Document Verification Officer | `document.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Examination Officer | `examination.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Interview Panel Member | `panel.one@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Public Relations / Content Officer | `content.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Management and Reporting Officer | `reporting.officer@kogicsc.kg.gov.ng` | `KogiCSC#2026` |
| Applicants | `applicant1@example.com` … `applicant33@example.com` | `Applicant#2026` |

Each role sees only the functions its role assigns. Signing in as different officers is the
quickest way to see role-based access control at work.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm start` | Serve the production build |
| `npm run setup` | Generate client, create the database and seed it |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:reset` | Recreate the database from scratch and reseed |
| `npm run db:seed` | Load seed data |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run the test suite in watch mode |
| `npm run typecheck` | Type-check without emitting |

---

## Architecture

A centralised web application, as described in proposal §8.

```
Public portal ─┐
Applicant portal ─┼─ Next.js App Router (server components + server actions)
Admin backend  ─┘        │
                         ├─ Authentication and session management  (src/lib/auth.ts)
                         ├─ Role-based access control              (src/lib/rbac.ts)
                         ├─ Recruitment workflow rules             (src/lib/workflow.ts)
                         ├─ Screening rules engine                 (src/lib/screening.ts)
                         ├─ Score validation and consolidation      (src/lib/scoring.ts)
                         ├─ Reporting and analytics                (src/lib/reports.ts)
                         ├─ Export to PDF / Excel / CSV            (src/lib/export.ts)
                         ├─ Notification service (email and SMS)   (src/lib/notifications.ts)
                         ├─ Secure document storage                (src/lib/storage.ts)
                         ├─ Audit trail                            (src/lib/audit.ts)
                         └─ Prisma ORM ─ central database + document repository
```

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Database | Prisma ORM. SQLite for development; change the `datasource` provider to `postgresql` for production |
| Styling | Tailwind CSS, responsive from 390px upwards |
| Authentication | Signed, HTTP-only session cookies (`jose`), bcrypt password hashing, lock-out after repeated failures |
| Validation | Zod schemas shared by forms and server actions |
| Documents | Stored outside the web root, served only through authorised routes |
| Email | Nodemailer over SMTP; logs and records delivery when no SMTP host is configured |
| SMS | Pluggable approved-gateway abstraction (transaction charges are billed separately) |
| Exports | `pdfkit` (PDF), `exceljs` (Excel), native CSV |
| Tests | Vitest (206 unit, rules-engine and integration) plus two Playwright browser suites (212 checks) — 418 in all |

### Directory layout

```
prisma/
  schema.prisma            42 models covering all eight modules
  seed.ts                  institutional data, roles, templates, settings
  seed-recruitment.ts      a complete sample exercise across all ten stages
src/
  app/
    (public)/              Module 1 — public portal
    (auth)/                registration, sign-in, password recovery
    portal/                Modules 2.2–2.4, 3 — applicant portal
    admin/                 Modules 1, 2, 4–8 — administrative backend
    api/
      files/               authorised document and attachment delivery
      reports/             PDF / Excel / CSV report exports
      health/              availability monitoring (§7.4)
  actions/                 server actions, one file per module area
  components/              UI kit, navigation, forms, content rendering
  lib/                     domain rules, services and helpers
tests/                     unit, rules-engine and integration tests
docs/                      manuals, deployment and testing reports
storage/uploads/           document repository (git-ignored)
```

---

## Configuration

Copy `.env.example` to `.env` and set the values.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Database connection. `file:./dev.db` for SQLite; a `postgresql://…` URL in production |
| `AUTH_SECRET` | Session signing key. **At least 32 characters; generate a fresh one per environment** |
| `APP_URL` | Public base URL, used in notification links |
| `UPLOAD_DIR` | Document repository path. Must be outside the web root and backed up |
| `MAX_UPLOAD_MB` | Default upload ceiling; each document requirement may set a lower limit |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email delivery. With no host, messages are logged and still recorded |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | Approved SMS gateway |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/REQUIREMENTS-TRACEABILITY.md`](docs/REQUIREMENTS-TRACEABILITY.md) | Every proposal clause mapped to the code that implements it |
| [`docs/USER-MANUAL.md`](docs/USER-MANUAL.md) | Applicant guide — registering through to the recruitment outcome |
| [`docs/ADMINISTRATOR-MANUAL.md`](docs/ADMINISTRATOR-MANUAL.md) | Officer guide for every role and every recruitment stage |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment, hosting, backup, recovery and monitoring |
| [`docs/TESTING-REPORT.md`](docs/TESTING-REPORT.md) | What was tested, how, and the results |
| [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md) | How the system supports the Nigeria Data Protection Act 2023 |

---

## Scope boundaries

Carried forward from proposal §14:

- The system supports recruitment administration and records. It does **not** independently
  determine legal eligibility or make statutory recruitment decisions.
- Final approval of successful candidates remains with the legally authorised government
  authorities.
- External identity, certificate, payment, SMS, email, CBT examination and government database
  integrations are subject to technical access, third-party approval and agreed scope. The
  notification service ships with a gateway abstraction ready for an approved provider.
- Hosting, domain renewal, SMS usage and third-party subscription charges are confirmed in the
  final agreement.

---

Developed and deployed by **Edumanager Information System Ltd.**
Miango Road, After INEC Office, Jos, Plateau State, Nigeria ·
edumanagerinfosys@gmail.com · www.edumanagerinfo.com
