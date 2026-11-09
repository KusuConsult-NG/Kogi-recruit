# Deployment and Operations

Kogi State Civil Service Commission Portal

Proposal §9.6 (production deployment) and §7.4 (availability and business continuity). Hosting
model, domain arrangements, storage capacity, traffic assumptions and infrastructure ownership are
agreed with the Kogi State Government at project initiation; this document sets out what the
application requires and how it is operated.

---

## 1. What the application needs

| Component | Minimum | Recommended for production |
|---|---|---|
| Node.js | 20 LTS | 22 LTS |
| Database | SQLite (development only) | PostgreSQL 15 or later |
| Application server | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM, two instances behind a load balancer |
| Document storage | Local disk | Network-attached or object storage, backed up |
| TLS | — | Required. Terminate at the load balancer or reverse proxy |
| SMTP | — | An authenticated relay for official email |
| SMS gateway | — | An approved Nigerian gateway |

Storage grows with applications. Budget roughly **8–12MB per applicant** for documents: 10,000
applicants is approximately 100GB.

---

## 2. Moving to PostgreSQL

SQLite is for development only. For production:

1. Change the datasource provider in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Point `DATABASE_URL` at the server:

```bash
DATABASE_URL="postgresql://kogicsc:<password>@db.internal:5432/kogicsc?schema=public&connection_limit=10"
```

3. Create the schema:

```bash
npx prisma migrate deploy
```

For the first deployment, generate the migration from the schema:

```bash
npx prisma migrate dev --name initial
```

Keep the generated migrations under version control so every environment is built the same way.

---

## 3. Environment variables

Set these in the environment, not in a file in the repository.

```bash
NODE_ENV=production
DATABASE_URL=postgresql://kogicsc:<password>@db.internal:5432/kogicsc
AUTH_SECRET=<64 random hex characters, unique to this environment>
APP_URL=https://portal.kogicsc.kg.gov.ng
UPLOAD_DIR=/var/lib/kogicsc/uploads
MAX_UPLOAD_MB=8

SMTP_HOST=smtp.kogicsc.kg.gov.ng
SMTP_PORT=587
SMTP_USER=<relay user>
SMTP_PASS=<relay password>
MAIL_FROM="Kogi State Civil Service Commission <no-reply@kogicsc.kg.gov.ng>"

SMS_PROVIDER=<approved gateway>
SMS_API_KEY=<gateway key>
SMS_SENDER_ID=KOGICSC
```

Generate the session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `AUTH_SECRET` signs every session. Changing it signs everyone out. It must differ between
> environments and must never be committed.
>
> With no `SMTP_HOST`, messages are logged and still recorded — useful in a test environment,
> never acceptable in production.

---

## 4. Deploying

```bash
npm ci --omit=dev && npm install --no-save prisma
```

```bash
npx prisma generate && npx prisma migrate deploy
```

```bash
npm run build
```

```bash
npm start
```

The server listens on `PORT` (default 3000). Run it behind a reverse proxy that terminates TLS.

### First-run administrator account

The seed script is for development. In production, create the first Super Administrator
deliberately:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
(async () => {
  const prisma = new PrismaClient();
  const password = require('crypto').randomBytes(9).toString('base64url');
  await prisma.user.create({
    data: {
      email: process.argv[1],
      fullName: process.argv[2],
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash(password, 10),
      mustChangePassword: true,
    },
  });
  console.log('Created. Temporary password:', password);
  await prisma.\$disconnect();
})();
" admin@kogicsc.kg.gov.ng "System Administrator"
```

That account then creates the Commission's officers through **Users & Roles**, so every later
account is created with an audit record.

**Never load development seed data into production.** It contains known passwords.

---

## 5. Reverse proxy

```nginx
server {
    listen 443 ssl http2;
    server_name portal.kogicsc.kg.gov.ng;

    ssl_certificate     /etc/ssl/certs/kogicsc.crt;
    ssl_certificate_key /etc/ssl/private/kogicsc.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    # Applicants upload documents; allow a little above MAX_UPLOAD_MB
    client_max_body_size 12m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}

server {
    listen 80;
    server_name portal.kogicsc.kg.gov.ng;
    return 301 https://$host$request_uri;
}
```

`X-Forwarded-For` matters: the audit trail records it as the originating address.

---

## 6. Running as a service

```ini
[Unit]
Description=Kogi State Civil Service Commission Portal
After=network.target postgresql.service

[Service]
Type=simple
User=kogicsc
WorkingDirectory=/opt/kogicsc-portal
EnvironmentFile=/etc/kogicsc/portal.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/kogicsc/uploads

[Install]
WantedBy=multi-user.target
```

```bash
sudo chmod 600 /etc/kogicsc/portal.env && sudo systemctl enable --now kogicsc-portal
```

---

## 7. Document storage

`UPLOAD_DIR` holds applicant documents, article attachments, downloads and the Commission
repository. It is **outside the web root** and is served only through authorisation-checked routes.

- Owned by the service user, mode `0700`.
- Never exposed by the web server directly.
- Included in the backup schedule — losing it loses applicants' certificates.

```bash
sudo install -d -o kogicsc -g kogicsc -m 0700 /var/lib/kogicsc/uploads
```

Where two or more application instances run, the directory must be shared storage.

---

## 8. Backup and recovery

Backup frequency and recovery objectives are finalised during technical design (§7.4). The
following is a sound default.

### Database

```bash
#!/usr/bin/env bash
# /usr/local/bin/kogicsc-backup-db
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=/var/backups/kogicsc
install -d -m 0700 "$DEST"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$DEST/kogicsc-$STAMP.dump"
find "$DEST" -name 'kogicsc-*.dump' -mtime +30 -delete
```

Nightly, retained 30 days, with a weekly copy held off-site.

### Documents

```bash
#!/usr/bin/env bash
# /usr/local/bin/kogicsc-backup-files
set -euo pipefail
rsync -a --delete /var/lib/kogicsc/uploads/ /var/backups/kogicsc/uploads/
```

Daily, mirrored off-site weekly.

### Suggested objectives

| Measure | Target |
|---|---|
| Recovery point objective | 24 hours (one day of data) |
| Recovery time objective | 4 hours |
| Backup retention | 30 days local, 12 months off-site |
| Restore rehearsal | Quarterly, into a test environment |

### Restoring

```bash
sudo systemctl stop kogicsc-portal
```

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" /var/backups/kogicsc/kogicsc-<stamp>.dump
```

```bash
rsync -a /var/backups/kogicsc/uploads/ /var/lib/kogicsc/uploads/
```

```bash
sudo systemctl start kogicsc-portal && curl -fsS https://portal.kogicsc.kg.gov.ng/api/health
```

A restore is only proven when it has been rehearsed. Rehearse quarterly.

---

## 9. Monitoring

`GET /api/health` returns:

```json
{ "status": "ok", "database": "reachable", "latencyMs": 2, "timestamp": "2026-11-07T06:00:00.000Z" }
```

It returns **503** with `"status": "degraded"` when the database is unreachable.

| What to watch | How | Alert when |
|---|---|---|
| Availability | `GET /api/health` every 60s | Two consecutive failures |
| Database latency | `latencyMs` | Above 500ms for 5 minutes |
| Disk | `UPLOAD_DIR` free space | Below 20% |
| Backups | Dump file present and non-trivial | Missing or unusually small |
| Failed sign-ins | **Audit Trail** page | A sustained rise |
| Certificate expiry | TLS probe | 21 days before expiry |

Around a closing date, load is highest in the final 48 hours. Watch database latency and disk.

---

## 10. Routine maintenance

| Task | Frequency |
|---|---|
| Review the audit trail for refused access and failed sign-ins | Weekly |
| Review open public enquiries | Weekly |
| Confirm backups completed | Daily, automated |
| Apply security updates (`npm audit`, OS packages) | Monthly |
| Rehearse a restore | Quarterly |
| Review accounts and deactivate officers who have moved on | Quarterly |
| Review retention against the Commission's schedule | Annually |

### Deploying an update

```bash
sudo systemctl stop kogicsc-portal
```

```bash
git pull && npm ci --omit=dev && npx prisma migrate deploy && npm run build
```

```bash
sudo systemctl start kogicsc-portal && curl -fsS https://portal.kogicsc.kg.gov.ng/api/health
```

Take a database backup before any deployment that includes a migration. Deploy outside an open
application window where possible.

---

## 11. Security checklist before going live

- [ ] `AUTH_SECRET` is 64 random hex characters, unique to this environment, not in the repository
- [ ] `NODE_ENV=production`, so session cookies are marked `secure`
- [ ] TLS terminates at the proxy; HTTP redirects to HTTPS; HSTS is set
- [ ] **No development seed data** — no account has a known password
- [ ] The first Super Administrator has changed their temporary password
- [ ] Every officer account has the narrowest role that fits their duties
- [ ] `UPLOAD_DIR` is outside the web root, mode `0700`, owned by the service user
- [ ] The database is not reachable from the public internet
- [ ] Database credentials are specific to this application, not a superuser
- [ ] Backups run, and a restore has been rehearsed
- [ ] `/api/health` is monitored with alerting
- [ ] SMTP is configured — otherwise applicants receive nothing
- [ ] The SMS gateway is configured and its charges are agreed
- [ ] The Commission has reviewed and published the privacy notice
- [ ] Retention, lawful basis and the data protection officer are set under **Settings**
- [ ] `npm audit` reviewed and any high findings resolved or accepted

---

## 12. Scaling

| Pressure | Response |
|---|---|
| High traffic near a closing date | Add application instances behind the load balancer; the application holds no server-side affinity |
| Slow reports | Add read replicas and point reporting at them |
| Document storage growth | Move `UPLOAD_DIR` to object storage with a shared mount |
| Large registers | Already paginated; raise `connection_limit` before adding instances |

---

## 13. Support

An initial **12-month post-deployment warranty and technical support period** runs from formal
acceptance and handover (proposal §12). It covers correction of reproducible defects within scope,
technical assistance to designated administrators, operational guidance, troubleshooting of
supported functions and minor adjustments to align delivered functions with approved
specifications.

It does not automatically include major new modules, substantial workflow changes, third-party
service charges, new infrastructure or integrations outside the agreed scope. These are handled
through an approved change request or a separate maintenance agreement.

When reporting a defect, include: what you did, what you expected, what happened, the time, the
officer's role, and the relevant audit trail reference.

**Edumanager Information System Ltd.** · edumanagerinfosys@gmail.com · www.edumanagerinfo.com
