# System Testing and Deployment Report

Kogi State Civil Service Commission Portal

Proposal §9.4 (testing and quality assurance), §9.5 (user acceptance testing) and §10 (deliverable:
system testing and deployment report).

---

## 1. Summary

| | |
|---|---|
| **Build** | Production build compiles successfully; 67 pages and 12 API routes |
| **Types** | TypeScript strict mode, no errors |
| **Automated tests** | **418 checks, all passing** |
| **Page errors** | None. No script error and no 5xx response during any browser run |
| **Modules covered** | All eight, plus the ten-stage workflow end to end |

| Suite | Checks | What it covers |
|---|---|---|
| Unit and rules-engine (`npm test`) | 160 | Workflow transitions, completeness, screening rules, score validation, RBAC, input validation, uploads, exports, content rendering, formatting |
| Database integration (`npm test`) | 46 | Seeded recruitment lifecycle, constraints, audit completeness, score consistency |
| Portal smoke (`npm run test:browser`) | 132 | Every page, registration, a full draft application, role-based access, authentication, exports, responsive layout |
| Full lifecycle (`npm run test:lifecycle`) | 80 | A complete recruitment exercise driven through the UI by each responsible officer |
| **Total** | **418** | |

---

## 2. What was tested, and how

### 2.1 Functional testing

A complete recruitment exercise was driven **through the user interface**, signing in as the
officer who holds the rights for each stage, then as the applicants.

| Stage | Verified |
|---|---|
| 1 Planning | Exercise created with description, eligibility and guidelines; vacancies added with qualification, experience and age criteria; required documents and custom questions configured |
| 2 Approval and publication | Submission for approval **refused** without an approved vacancy; the preparing officer is not offered the approval action; the Director approves and publishes; the exercise becomes publicly visible |
| 3 Registration | Three applicants registered, issued applicant references, and completed their profiles |
| 4 Submission | Qualifications added; every required document uploaded; next of kin and additional questions completed; declaration and consent confirmed; applications submitted with a reference and an acknowledgement |
| 5 Document verification | 15 documents verified by the Document Verification Officer |
| 5 Screening | Applications assigned to a screening officer; preliminary checks shown with a suggested outcome; two candidates passed; one disqualified with a recorded reason |
| 6 Shortlisting | Shortlist prepared from qualified applications, submitted, approved by the Director; candidates marked shortlisted and notified |
| 7 Examination | Examination and centre created; allocation **refused** before a centre existed; candidates allocated with unique examination numbers and seats, and notified; scores recorded; results validated and released |
| 8 Interview | Interview created; scheduling **refused** before a panel existed; panel created with a chair; candidates scheduled with time slots and notified; scores recorded by a panel member against the approved framework; panel mean shown; assessments consolidated |
| 9 Final selection | List prepared with weighted ranking and vacancy fill; submitted; approved; every candidate notified |
| 10 Closure | Records archived, the exercise closed, and the public page shows it is no longer accepting applications |
| Applicant view | Each applicant sees a concluded outcome, their examination and interview details, their full application history, and the notifications they were sent |

### 2.2 Application submission and document handling

| Check | Result |
|---|---|
| A draft can be saved and resumed | ✓ |
| Submission is blocked while a mandatory section is outstanding, and the page says which | ✓ |
| A qualification can be added and is shown on the application | ✓ |
| A passport photograph (JPEG) uploads to its requirement | ✓ |
| An educational certificate (PDF) uploads to its requirement | ✓ |
| A PDF is refused where the requirement accepts images only | ✓ |
| An executable is refused outright | ✓ |
| An executable renamed `.pdf` is refused by the magic-byte check | ✓ (unit) |
| A file above the requirement's size limit is refused, naming the limit | ✓ (unit) |
| A re-upload supersedes the previous copy, keeping the review history | ✓ (unit, integration) |
| A rejected document carries the officer's reason, visible to the applicant | ✓ |

### 2.3 Access-control testing

Every restriction was exercised against a live session for each role.

| Role | Reaches | Refused |
|---|---|---|
| Content Officer | News & Notices | Users & Roles, Settings, Applications |
| Screening Officer | Screening | Users & Roles, Final Selection |
| Interview Panel Member | Their interviews, exercises | Screening, Audit Trail |
| Reporting Officer | Reports | Users & Roles |
| Examination Officer | Examinations | Interviews |
| Document Officer | Document Verification | Shortlists |

Also verified:

- a refusal **explains the role's coverage** rather than showing a generic error;
- the navigation **hides** functions the role lacks;
- an officer who manages interviews but does not sit on the panel is **not offered a score sheet**;
- an applicant is redirected away from the administration area;
- unauthenticated access to `/admin` and `/portal` redirects to sign-in;
- an unauthenticated report export returns **401**;
- an unauthenticated applicant-document request returns **401**;
- a wrong password is rejected, and the attempt is recorded;
- a refused access attempt appears in the audit trail.

### 2.4 Recruitment workflow rules

28 automated checks on the workflow engine, including:

| Rule | Result |
|---|---|
| An exercise cannot be published without approval | Refused |
| An exercise cannot be submitted for approval with no vacancy | Refused |
| A closed or archived exercise cannot be edited | Refused |
| An application cannot skip screening to shortlisting | Refused |
| A candidate cannot be selected without assessment | Refused |
| A concluded outcome is terminal | Enforced |
| An application cannot be withdrawn after selection | Refused |
| A correction request returns the application for re-screening | Permitted |
| Every status maps to the correct one of the ten stages | Verified |

Every status-history chain in the seeded data was replayed through the transition rules; all
transitions are legal.

### 2.5 Screening and scoring

| Check | Result |
|---|---|
| Qualification ranking orders SSCE below OND below HND below Masters below Ph.D | ✓ |
| An HND and a first degree rank equally | ✓ |
| Experience is totalled across employment records, counting a current post to today | ✓ |
| A minimum is read from free text ("minimum of 3 years") | ✓ |
| A fully compliant application is suggested as passed | ✓ |
| A rejected document suggests a correction request | ✓ |
| An under-qualified applicant is suggested as failed | ✓ |
| An applicant outside the age range is suggested as disqualified | ✓ |
| A requirement with no stated limit is marked **advisory**, not failed | ✓ |
| A free-text requirement that cannot be parsed asks for officer review | ✓ |
| Every check records a reason | ✓ |
| A screening failure is refused without remarks | ✓ (through the UI) |

| Scoring check | Result |
|---|---|
| A score above the total marks is refused by the field **and** by the server | ✓ |
| A negative or non-numeric score is refused | ✓ |
| An empty score is not silently treated as zero | ✓ |
| A criterion score above its maximum is refused | ✓ |
| Panel scores consolidate to their mean | ✓ |
| The final score applies the approved weighting | ✓ |
| Candidates rank by final score; equal scores share a rank | ✓ |
| Selection never exceeds a vacancy's approved posts | ✓ |
| Bulk upload reports the line number of a bad score and still applies the valid rows | ✓ |
| An unmatched examination number is reported, not silently dropped | ✓ |

### 2.6 Reporting and exports

| Export | Result |
|---|---|
| Recruitment report — PDF | 200, `application/pdf`, valid `%PDF-` header |
| Recruitment report — Excel | 200, valid XLSX (ZIP container) |
| Recruitment report — CSV | 200, UTF-8 with BOM, separators and quotes escaped |
| Application register — CSV | 200, 25 columns per application |
| Audit trail — PDF | 200, paginated with a restricted-use footer |
| Shortlist, examination, interview and selection reports | 200 |
| A completed exercise exports in all three formats | ✓ |
| Export requires the export permission | ✓ |
| Every export is recorded in the audit trail | ✓ |

### 2.7 Security testing

| Check | Result |
|---|---|
| Passwords stored as bcrypt hashes, never in clear text | ✓ |
| A seeded password verifies against its hash; a wrong one does not | ✓ |
| Account lock-out after repeated failures | ✓ |
| Password recovery does not reveal whether an account exists | ✓ |
| Public tracking requires reference **and** surname; a mismatch discloses nothing | ✓ |
| Authored content is escaped; `<script>` is not rendered as markup | ✓ |
| A `javascript:` link is refused | ✓ |
| Document paths cannot traverse outside the store | ✓ |
| Duplicate email, reference and examination number are refused | ✓ |
| One application per applicant, exercise and vacancy is enforced | ✓ |
| Deleting an application cascades to its child records | ✓ |
| Sensitive audit records are withheld from roles without rights | ✓ |

### 2.8 Audit trail completeness

Every recruitment action performed during the lifecycle run was then found in the audit trail:
exercise created, approved and published; application submitted; document reviewed; screening
assigned and recorded; shortlist approved; examination candidates assigned, scores recorded and
validated; interview score recorded; selection prepared and approved; access refused.

Each record names the officer, their role, the record affected, a summary and the time. Score
entry, approvals and permission changes are marked **sensitive**.

### 2.9 Browser and responsiveness

Rendered in Chromium at desktop width and at **390px** (phone). No horizontal overflow on the home
page, the recruitment listing, the FAQ page or the sign-in page. Layouts use responsive grids
throughout, and registers scroll horizontally within their own container rather than breaking the
page.

### 2.10 Availability

`GET /api/health` returns `{"status":"ok","database":"reachable","latencyMs":1}` and **503** with
`"status":"degraded"` when the database is unreachable.

---

## 3. Defects found and corrected during testing

Testing found seven defects. All were corrected and each now has a regression test.

| # | Defect | Effect | Correction | Regression test |
|---|---|---|---|---|
| 1 | Empty optional number and date fields were coerced to `0` or an invalid date | Adding a qualification failed if the year was left blank; a vacancy could not be saved without age limits | Blank optional fields are treated as absent | `tests/validation.test.ts` — "empty optional form fields" |
| 2 | The submit control required the declaration, which is only stored **by** submitting | An application could never be submitted — a deadlock | The declaration is validated on the submission form, not as a precondition | `tests/workflow.test.ts` — "the declaration does not block submission" |
| 3 | Examination numbers restarted at `000001` for each schedule, but are globally unique | Allocating candidates to a second examination failed on a unique constraint | The sequence continues from the highest number issued that year, with a retry | `tests/integration.test.ts` — "examination numbers are unique across the portal" |
| 4 | An empty score was accepted as `0` | A blank field could record a zero score | An absent score is refused | `tests/scoring.test.ts` |
| 5 | A page outside an officer's role threw, producing a generic error screen with the reason redacted in production | An officer was told nothing useful, and the attempt was not recorded | Pages redirect to a refusal page that explains the role's coverage, and the attempt is audited | Lifecycle and smoke suites, 17 role checks |
| 6 | Confirmation messages vanished when the action changed state and unmounted the form | An officer approving a shortlist or allocating candidates saw no confirmation | Confirmations are shown as a banner that survives the re-render | Lifecycle suite |
| 7 | The reason a score was refused was not displayed on the score row | The officer saw only "check the score entered" | The specific reason is shown | Lifecycle suite |

Two further improvements were made on the back of testing:

- the applicant's application page now states plainly what has happened at each status —
  submitted, under screening, qualified, shortlisted, withdrawn — rather than relying on a badge;
- interview scoring is restricted to members of the candidate's own panel, in both the interface
  and the server action, rather than also allowing any officer who manages interviews.

---

## 4. Running the tests

```bash
npm test
```

```bash
npm run db:reset && npm run build && npm start
```

```bash
npm run test:browser
```

```bash
npm run test:lifecycle
```

`npm test` creates and seeds its own database, so it is repeatable and never touches development
data. The browser suites need a running server; see `tests/browser/README.md`.

```bash
npm run test:all
```

---

## 5. User acceptance testing

Automated testing establishes that the system behaves as specified. **User acceptance testing
remains with the Commission** (proposal §9.5): designated officers test the platform against the
agreed requirements, issues are documented and addressed, and acceptance is recorded before
production deployment.

To prepare a UAT environment:

```bash
npm run setup
```

This loads one account for each of the ten staff roles and a complete sample exercise with 33
applicants spread across every stage, so each officer can exercise their own functions
immediately. Sign-in details are in `README.md`.

Suggested UAT coverage, by role:

| Role | Should confirm |
|---|---|
| Commission Administrator | Create and approve an exercise; manage accounts; review the audit trail |
| Recruitment Officer | Configure an exercise and its vacancies; assign screening; prepare a shortlist and a selection list |
| Recruitment Director | Approve an exercise, a shortlist and a selection list; return one with a reason |
| Screening Officer | Screen assigned applications; request a correction; record a disqualification with its reason |
| Document Officer | Verify, reject and request correction of documents |
| Examination Officer | Create an examination and centres; allocate candidates; record and bulk-upload scores; validate |
| Interview Panel Member | Record scores for their panel's candidates only |
| Content Officer | Publish an announcement and a circular; respond to an enquiry |
| Reporting Officer | Generate and export each report |
| Applicant | Register, apply, upload documents, correct a rejected document, track the application |

---

## 6. Build verification

```
✓ Compiled successfully
  67 pages
  12 API routes
  First load JS shared by all: 105 kB
```

| Measure | Value |
|---|---|
| Database models | 49 |
| Pages | 67 |
| API routes | 12 |
| Server actions | 92 |
| Source files | 185 |
| Lines of code and documentation | ~37,100 |
| TypeScript errors | 0 |
| Automated checks | 418, all passing |

---

## 7. Known boundaries

These follow the proposal's own scope boundaries (§14) and are not defects.

| Area | Position |
|---|---|
| CBT platform integration | Scoped separately after technical assessment (§2.6). Bulk score upload accepts CBT output today |
| External identity and certificate verification | Not performed; subject to technical access and agreed scope |
| SMS gateway | A provider abstraction ships ready for configuration; transaction charges are separate |
| Hosting, backup frequency and recovery objectives | Finalised during technical design; procedures in `docs/DEPLOYMENT.md` |
| Concurrent-user capacity | Per the agreed hosting capacity; the application scales horizontally |
| Legal eligibility and statutory decisions | Not determined by the system; final approval rests with the legally authorised government authorities |

---

Prepared by **Edumanager Information System Ltd.** · edumanagerinfosys@gmail.com
