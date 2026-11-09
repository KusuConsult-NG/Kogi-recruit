# Data Protection

How the portal supports the Commission's obligations under the **Nigeria Data Protection Act
2023**. Proposal §7.5.

The Commission is the data controller. It determines the lawful bases for processing, retention
periods, access authorisations and privacy notices. This document sets out what the system
provides so those decisions can be given effect.

---

## 1. What personal information the portal holds

| Category | Fields | Where |
|---|---|---|
| Identity | Surname, first and middle names, gender, date of birth, marital status, NIN | `ApplicantProfile` |
| Contact | Email address, telephone numbers, residential address, city, State of residence | `User`, `ApplicantProfile` |
| Origin | State and Local Government Area of origin, nationality | `ApplicantProfile` |
| Special category | Declared disability or special requirements | `ApplicantProfile.disability` |
| Education | Institutions, qualifications, courses, grades, years, certificate numbers | `ApplicationEducation` |
| Employment | Employers, positions, periods, responsibilities | `ApplicationEmployment` |
| Third parties | Referee and next-of-kin names and contact details | `ApplicationReferee`, `NextOfKin` |
| Documents | Photographs, certificates, NIN evidence and other uploads | `ApplicantDocument` + document store |
| Assessment | Screening outcomes and remarks, examination and interview scores, recruitment outcome | `ScreeningRecord`, `ExamCandidate`, `InterviewScore`, `SelectionEntry` |
| Activity | Sign-in history, IP addresses, audit records | `LoginHistory`, `AuditLog` |
| Staff | Officer names, emails, telephone numbers, roles, staff numbers, departments | `User` |

Referee and next-of-kin details are supplied **by the applicant about another person**. The
privacy notice tells applicants to inform those people, and only a name and contact details are
collected.

---

## 2. Lawful basis and purpose

Processing is for **recruitment administration**: verifying eligibility, screening and shortlisting,
administering examinations and interviews, documenting outcomes and maintaining Commission
records.

The Commission records its chosen lawful basis under **Settings → Data protection**; the default
reflects the performance of a public task in the public interest. Applicants are additionally
asked for explicit consent at registration and again when submitting each application, and the
consent is stored against the application (`Application.consent`).

The portal does **not** use personal information for any purpose other than the exercise it was
submitted for. There is no profiling, no automated decision-making that determines an outcome, and
no disclosure to third parties.

---

## 3. Automated processing

Preliminary screening checks compare an application against the vacancy's criteria — completeness,
documents attached, qualification, experience and age — and **suggest** an outcome.

**No decision is made automatically.** Every screening outcome is recorded by a named officer, who
may accept or depart from the suggestion. A check the system cannot evaluate is marked for officer
review rather than failed. The decision, the officer and the reason are retained
(`ScreeningRecord`), and the applicant is told the reason.

This is what proposal §2.5 requires: *"Configurable rules may assist preliminary checks, but final
decisions remain with authorised Commission officers."*

---

## 4. Who can see what

Applicant personal information **is not publicly accessible merely because it has been submitted
through the portal.**

| Who | What they can see |
|---|---|
| The public | Published institutional content, vacancies, news and notices only. No applicant data |
| An applicant | Their own profile, applications, documents, scores, outcome and notifications |
| Public tracking | A summary of one application, and only on both its reference **and** the applicant's surname |
| Screening Officer | Applications assigned to them, with the documents needed to screen them |
| Document Officer | Documents pending review and the application they belong to |
| Examination Officer | Candidate lists and scores for their examinations |
| Interview Panel Member | Candidates on **their own panel** only |
| Reporting Officer | Dashboards, reports and exports; no editing |
| Director / Commission Administrator | The full recruitment record for their functions |
| Super Administrator | Everything, including user and system administration |

Enforcement is in three layers: navigation hides what a role lacks; every page checks the
permission before rendering anything; and every server action and API route checks again. A direct
URL to a restricted page is refused with an explanation, and the attempt is recorded.

### Document access

An applicant document is never served from a public path. Retrieval requires an authenticated
session and either ownership of the application or a document-review or application-view
permission. **Every access by an officer is recorded in the audit trail** with the officer, the
document and the time.

---

## 5. Security measures

| Measure | Implementation |
|---|---|
| Password storage | bcrypt, cost factor 10. Never logged, never returned |
| Session management | Signed HTTP-only, same-site cookies; server-side session records; revocation on deactivation or password reset; expiry |
| Brute-force resistance | Account lock-out after five failed attempts; every attempt recorded |
| Transport | HTTPS enforced at the hosting layer; `secure` cookies in production |
| Input validation | Zod schemas on every form and action; database-level constraints |
| Injection resistance | Parameterised queries throughout; no string-built SQL |
| Content rendering | Authored content escaped before rendering; only `http`, `https` and relative links permitted |
| Upload safety | Declared type checked against the file's own magic bytes; size limits; path-traversal guard; stored outside the web root |
| Account enumeration | Password recovery reports the same outcome whether or not an account exists |
| Tracking disclosure | Reference **and** surname must both match; a mismatch discloses nothing |
| Audit integrity | No update or delete path for audit records exists in the portal |

---

## 6. Retention

Retention is a Commission decision, recorded under **Settings → Data protection**
(`dataProtection.retentionMonths`, 60 months by default).

The portal supports retention in these ways:

- Concluded exercises are **archived, not destroyed**, so recruitment decisions remain
  auditable.
- Officer accounts are **deactivated, not deleted**, so decisions stay attributable.
- Records carry classifications (general, confidential, restricted) so disposal can follow the
  Commission's schedule.
- Withdrawn applications are retained with their withdrawal date.

Disposal at the end of the retention period is an operational procedure carried out under the
Commission's records retention and disposal schedule; the portal does not delete records on its
own.

---

## 7. Data subject rights

| Right | How it is served |
|---|---|
| Information | The privacy notice is published on the portal and is Commission-editable; consent is sought at registration and at each submission |
| Access | An applicant sees their full record in their portal at any time; a written request is served from the application register export |
| Rectification | An applicant corrects their own profile and, where a correction is requested, re-uploads documents. Officers correct records they are responsible for, and the change is audited |
| Objection and restriction | An applicant may withdraw an application at any time before assessment |
| Portability | The application register exports to Excel and CSV |
| Complaint | The data protection officer's address is configured under **Settings** and published in the privacy notice |

A right of access or rectification is exercised by writing to the Commission, quoting the
applicant reference. The audit trail evidences how the request was handled.

---

## 8. Special category and sensitive data

**Declared disability** is collected only so the Commission can make reasonable arrangements. It
is optional, and it is not part of screening or scoring.

**Gender** is collected for the statistics the proposal provides for, and reported **only where
lawfully permitted and approved by the Commission**. The setting is
`dataProtection.collectGender`, and every gender report states the basis on its face.

**NIN** is optional on the profile and required only where a recruitment exercise asks for
evidence of it.

---

## 9. Breach preparedness

The audit trail is the primary evidence for an investigation. It records who accessed which
applicant document and when, every sign-in and failure with its IP address, every permission and
role change, every data export with the format and record count, and every refused access
attempt.

On suspicion of a breach:

1. Deactivate the account concerned — live sessions are signed out immediately.
2. Export the audit trail for the relevant period (**Audit Trail → Export**).
3. Establish from it what was accessed and by whom.
4. Report to the Nigeria Data Protection Commission within the statutory period if the breach
   meets the threshold.
5. Notify affected data subjects where required.

Report-export records are especially relevant: the application register contains personal
information in bulk, and every export is attributed to an officer.

---

## 10. Before going live

- [ ] The Commission has reviewed and published the privacy notice (**Content → Institutional
      Pages → Privacy notice**)
- [ ] The lawful basis is recorded under **Settings → Data protection**
- [ ] The retention period reflects the Commission's records schedule
- [ ] Whether gender statistics are collected has been decided and recorded
- [ ] The data protection officer's contact address is set and published
- [ ] Every officer account holds the narrowest role that fits their duties
- [ ] Officers have been briefed that opening an applicant document is logged
- [ ] The document store is on backed-up storage outside the web root
- [ ] TLS is enforced
- [ ] A breach response procedure is in place and the responsible officer named

---

## 11. Boundaries

The portal supports recruitment administration and records. It does not independently determine
legal eligibility or make statutory recruitment decisions. Final approval of successful candidates
remains with the legally authorised government authorities.

No external identity, certificate or government database verification is performed. Where such
integration is later agreed, it is scoped separately and its data protection implications assessed
at that point.
