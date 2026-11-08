# Requirements Traceability

Every requirement in *Product Development and Deployment Proposal — Kogi State Civil Service
Commission Portal* mapped to the code that implements it.

Legend: **✓ Implemented** · **◐ Implemented with a configurable boundary** (the proposal defers
the detail to the Commission, technical design or a third party)

---

## 3. Project objectives

| Objective | Status | Where |
|---|---|---|
| Digitise and streamline approved Commission administrative processes | ✓ | `src/app/admin/**`, `src/app/admin/records/**` |
| Establish an online recruitment and application management platform | ✓ | `src/app/portal/**`, `src/app/admin/exercises/**` |
| Centralise applicant records and supporting documents | ✓ | `prisma/schema.prisma` (`ApplicantProfile`, `Application`, `ApplicantDocument`), `src/lib/storage.ts` |
| Automate recruitment workflows from vacancy publication to final selection | ✓ | `src/lib/workflow.ts`, `src/actions/recruitment.ts`, `src/actions/screening.ts`, `src/actions/assessment.ts` |
| Improve transparency, accountability and traceability | ✓ | `src/lib/audit.ts`, `ApplicationStatusHistory`, `ApprovalRequest`, `src/app/admin/audit` |
| Enable secure communication between the Commission and applicants | ✓ | `src/lib/notifications.ts`, `src/app/admin/notifications/**`, `src/app/portal/notifications` |
| Provide management dashboards and reports | ✓ | `src/lib/reports.ts`, `src/app/admin/reports`, `src/app/api/reports/**` |
| Reduce paperwork and repetitive administrative processing | ✓ | Online applications, digital documents, bulk screening, bulk score upload |
| Provide a scalable foundation for future authorised integrations | ✓ | Service abstractions in `src/lib/notifications.ts`; Prisma datasource switchable to PostgreSQL |

---

## 4. Proposed product overview

### 4.1 Public-facing portal

| Requirement | Status | Where |
|---|---|---|
| Commission homepage, profile, functions and responsibilities | ✓ | `src/app/(public)/page.tsx`, `src/app/(public)/about/page.tsx`; content in `PageContent` |
| Approved leadership profiles, departments and units | ✓ | `src/app/(public)/leadership`, `src/app/(public)/departments` |
| News, official announcements, public notices and circulars | ✓ | `src/app/(public)/news`, `src/app/(public)/news/[slug]`, `src/app/(public)/notices` |
| Recruitment announcements, vacancies and application guidelines | ✓ | `src/app/(public)/recruitment`, `src/app/(public)/recruitment/[id]`, `.../process` |
| Applicant registration, login and application tracking | ✓ | `src/app/(auth)/register`, `.../login`, `src/app/(public)/track` |
| Frequently asked questions, contact details and enquiry submission | ✓ | `src/app/(public)/faqs`, `src/app/(public)/contact` |
| Downloads for approved forms, guidelines and publications | ✓ | `src/app/(public)/downloads`, `src/app/api/files/download/[id]` |

### 4.2 Secure administrative backend

| Requirement | Status | Where |
|---|---|---|
| Restricted to authorised officers | ✓ | `src/app/admin/layout.tsx`, `src/lib/page-guards.ts` |
| Content management | ✓ | `src/app/admin/content/**` |
| Recruitment administration | ✓ | `src/app/admin/exercises/**` |
| Applicant management | ✓ | `src/app/admin/applications/**` |
| Screening | ✓ | `src/app/admin/screening` |
| Document review | ✓ | `src/app/admin/documents` |
| Examination and interview administration | ✓ | `src/app/admin/examinations/**`, `src/app/admin/interviews/**` |
| Reporting | ✓ | `src/app/admin/reports`, `src/app/api/reports/**` |
| User management | ✓ | `src/app/admin/users/**` |
| Audit logs | ✓ | `src/app/admin/audit` |
| System configuration | ✓ | `src/app/admin/settings` |

---

## 5. Detailed product features and use cases

### Module 1 — Public information and content management

| Feature | Status | Where |
|---|---|---|
| Homepage and institutional content management | ✓ | `src/app/admin/content/pages`, `savePageContent` |
| Leadership and department profiles | ✓ | `src/app/admin/content/leadership`, `.../departments` |
| News and announcements | ✓ | `src/app/admin/content`, `createArticle` / `updateArticle` |
| Circulars and public notices | ✓ | Same, with `ARTICLE_TYPES` covering circular, notice and recruitment notice |
| Recruitment notices | ✓ | `ARTICLE_TYPES.RECRUITMENT_NOTICE` |
| Downloadable documents | ✓ | `src/app/admin/content/downloads`, `uploadDownload` |
| FAQs | ✓ | `src/app/admin/content/faqs`, `saveFaq` |
| Contact and enquiry management | ✓ | `src/app/admin/enquiries`, `submitEnquiry`, `respondToEnquiry` |
| **Use case: publishing an official announcement** | ✓ | Officer signs in → creates the item → previews → submits for approval where the role requires it → an authorised officer publishes → the publishing officer, date and time are recorded (`Article.publishedById`, `publishedAt`, `AuditLog`) |
| Officers publish without developer intervention | ✓ | All content is database-backed and edited through the backend |

### Module 2 — Civil Service Recruitment Management System

#### 2.1 Recruitment exercise and vacancy management

| Feature | Status | Where |
|---|---|---|
| Create multiple recruitment exercises | ✓ | `createExercise`; `RecruitmentExercise` |
| Titles and reference numbers | ✓ | Auto-generated by `exerciseReference`, or entered; uniqueness enforced |
| Opening and closing dates | ✓ | `opensAt`, `closesAt`; enforced by `exerciseAcceptsApplications` |
| Approved vacancies, job titles, grade levels, departments or agencies | ✓ | `Vacancy`; `createVacancy` |
| Qualification and experience criteria | ✓ | `Vacancy.qualifications`, `.experience`, `.minAge`, `.maxAge` |
| Configure application requirements | ✓ | `DocumentRequirement`, `FormField`; `saveDocumentRequirement`, `saveFormField` |
| Activate, suspend, close and archive exercises | ✓ | `EXERCISE_TRANSITIONS`, `changeExerciseStatus` |
| Monitor application volumes | ✓ | Exercise detail page and `src/lib/reports.ts` |
| **Use case: creating a recruitment exercise** | ✓ | Administrator creates → enters title, description and reference → enters approved vacancies and posts → configures eligibility, requirements and dates → submits for approval → an authorised officer approves and publishes → applicants may apply |

#### 2.2 Applicant registration and account management

| Feature | Status | Where |
|---|---|---|
| Online registration | ✓ | `registerApplicant`, `registerSchema` |
| Email and telephone capture | ✓ | Validated Nigerian telephone format (`phoneSchema`) |
| Secure login | ✓ | `authenticate`; bcrypt, signed session cookies, lock-out |
| Password recovery | ✓ | `requestPasswordReset`, `resetPassword`; single-use, 60-minute token |
| Applicant profile management | ✓ | `src/app/portal/profile`, `saveProfile` |
| Unique application reference number | ✓ | `applicantReference`, `applicationReference` |
| Applicant dashboard | ✓ | `src/app/portal/page.tsx` |
| Application history and status tracking | ✓ | `ApplicationStatusHistory`; shown on the dashboard and application detail |
| **Use case: applicant account registration** | ✓ | Applicant opens the portal → Create Account → supplies details → the system validates and creates the account → a confirmation is sent and the applicant signs in to complete the application |

#### 2.3 Online application form

| Feature | Status | Where |
|---|---|---|
| Personal and contact information | ✓ | `ApplicantProfile`; `applicantProfileSchema` |
| Address, State and LGA | ✓ | `NIGERIAN_STATES`, `KOGI_LGAS` |
| Educational and professional qualifications | ✓ | `ApplicationEducation`; `addEducation` |
| Employment history and experience | ✓ | `ApplicationEmployment`; `addEmployment` |
| Skills | ✓ | `Application.skills`; `saveAdditionalDetails` |
| Preferred position | ✓ | `Application.vacancyId`; chosen when starting the application |
| Referee and next-of-kin information | ✓ | `ApplicationReferee`, `NextOfKin` |
| Declaration and consent | ✓ | `Application.declaration`, `.consent`; required to submit |
| Configurable forms | ✓ | `FormField` per exercise, rendered by `AdditionalDetailsForm` |
| Mandatory field validation | ✓ | `computeCompleteness`; submission blocked until complete |
| Unique reference and acknowledgement | ✓ | `submitApplication`; `APPLICATION_ACKNOWLEDGEMENT` template |
| **Use case: submitting an application** | ✓ | Applicant signs in → selects an active exercise → reads the guidelines → completes the form → enters qualifications and employment → uploads documents → the system validates mandatory fields → the applicant reviews, confirms the declaration and submits → a unique reference and acknowledgement are generated |

#### 2.4 Document upload and management

| Feature | Status | Where |
|---|---|---|
| Passport photographs, birth certificates / age declarations | ✓ | `DOCUMENT_TYPES` |
| NIN evidence where required | ✓ | `DOCUMENT_TYPES.NIN` |
| Educational certificates and transcripts | ✓ | `DOCUMENT_TYPES` |
| NYSC discharge or exemption certificates | ✓ | `DOCUMENT_TYPES.NYSC` |
| Professional certificates, employment records, other specified documents | ✓ | `DOCUMENT_TYPES` |
| Secure upload | ✓ | `storeFile`; stored outside the web root |
| File type and size validation | ✓ | `validateUpload`, including magic-byte verification |
| Categorisation | ✓ | `ApplicantDocument.docType`, `requirementId` |
| Preview and retrieval | ✓ | `src/app/api/files/document/[id]`, authorisation-checked |
| Review status | ✓ | `reviewStatus`: pending, verified, rejected, resubmission required |
| Rejection and resubmission workflow | ✓ | `reviewDocument`; reopens the application and notifies the applicant |
| Document audit history | ✓ | `DocumentReview`; version tracking on `ApplicantDocument` |
| **Use case: reviewing applicant documents** | ✓ | Officer opens the record → views and checks each document against the requirements → records the outcome and the reason for any deficiency → where resubmission is permitted the applicant is notified → the review history is retained |

#### 2.5 Application screening and shortlisting

| Feature | Status | Where |
|---|---|---|
| Completeness checks | ✓ | `computeCompleteness`; surfaced in the officer's checks |
| Eligibility, qualification and experience screening | ✓ | `runAutoChecks`, `qualificationRank`, `yearsOfExperience` |
| Application classification | ✓ | `SCREENING_CLASSIFICATIONS` |
| Screening remarks | ✓ | `ScreeningRecord.remarks`; required on a failure or correction |
| Shortlisting | ✓ | `createShortlist`, `Shortlist`, `ShortlistEntry` |
| Disqualification records | ✓ | `ScreeningRecord`; status `DISQUALIFIED` with the reason retained |
| Officer assignment | ✓ | `assignScreening`, `ScreeningAssignment` |
| Bulk processing | ✓ | `bulkScreen`; the screening workspace selects many applications |
| Screening statistics | ✓ | `src/lib/reports.ts`; the screening workspace header |
| Configurable rules assist, officers decide | ✓ | `runAutoChecks` only *suggests*; the officer records the decision against their name |
| **Use case: screening and shortlisting** | ✓ | Administrator assigns applications → officers review details and documents against approved criteria → outcomes recorded and applications classified → an authorised officer prepares the shortlist → the shortlist is submitted for approval → approved candidates are notified |

#### 2.6 Examination and assessment management

| Feature | Status | Where |
|---|---|---|
| Examination schedules | ✓ | `ExamSchedule`; `createExamSchedule` |
| Candidate lists | ✓ | `ExamCandidate`; `assignExamCandidates` |
| Centre allocation | ✓ | `ExamCentre`; allocation prefers the candidate's own LGA and respects capacity |
| Candidate identification | ✓ | Unique `examNumber` and seat number |
| Score entry | ✓ | `recordExamAttendanceAndScore` |
| Bulk score upload | ✓ | `bulkUploadExamScores`, `parseBulkScores` (CSV upload or paste) |
| Score validation | ✓ | `validateScore`; `validateExamScores` requires complete attendance and scores |
| Performance reports | ✓ | `src/app/api/reports/examination` |
| Assessment status | ✓ | `ExamSchedule.status`, `ExamCandidate.attendance`, `.validated` |
| Integration with an approved CBT platform | ◐ | Scoped separately after technical assessment (proposal §2.6). Bulk score upload accepts CBT output today |
| **Use case: managing a recruitment examination** | ✓ | The Commission approves candidates → the administrator creates the schedule with dates, times and centres → candidates are allocated and informed → attendance and scores are recorded → assessment reports are generated → approved candidates progress |

#### 2.7 Interview management

| Feature | Status | Where |
|---|---|---|
| Interview schedules, dates and time allocation | ✓ | `InterviewSchedule`; slots allocated from `slotMinutes` |
| Venue management | ✓ | `InterviewSchedule.venue`, `InterviewPanel.roomVenue` |
| Panel assignment | ✓ | `InterviewPanel`, `InterviewPanelMember`; `createPanel` |
| Candidate lists | ✓ | `InterviewCandidate`; `assignInterviewCandidates` round-robins across panels |
| Attendance records | ✓ | `InterviewCandidate.attendance` |
| Score entry and remarks | ✓ | `recordInterviewScore`; per-criterion score sheet per panel member |
| Approved assessment framework | ✓ | `DEFAULT_INTERVIEW_CRITERIA`, editable per interview via `saveInterviewCriteria` |
| Result consolidation | ✓ | `consolidatePanelScores` (mean of the panel), `consolidateInterviews` |
| Interview reports | ✓ | `src/app/api/reports/interview` |
| **Use case: conducting interviews** | ✓ | The administrator selects approved candidates → dates, times and venues configured and candidates notified → panels assigned → panel members access their candidate list and record scores and remarks against the approved framework → the system consolidates the assessments for review and approval |

#### 2.8 Final selection and recruitment outcome

| Feature | Status | Where |
|---|---|---|
| Consolidated assessment records | ✓ | `SelectionEntry` holds the examination, interview and final scores |
| Final selection lists | ✓ | `SelectionList`; `createSelectionList` ranks and provisionally fills each vacancy |
| Approval workflow | ✓ | `decideSelectionList`; prepare → submit → approve or return |
| Outcome documentation | ✓ | `src/app/api/reports/selection` (PDF and Excel) |
| Candidate notifications | ✓ | `SELECTION_SUCCESSFUL` and `SELECTION_UNSUCCESSFUL` templates, sent on approval |
| Exercise closure | ✓ | `archiveSelectionList` closes the exercise |
| Successful / unsuccessful classification | ✓ | `SelectionEntry.outcome`; `Application.status` |
| Historical records | ✓ | Records are archived, never destroyed |
| **Use case: approving successful candidates** | ✓ | The Commission reviews consolidated results → authorised officers verify and confirm the list → the approving officer and date are recorded → successful candidates are marked selected and all applicants notified → the records are archived |

### Module 3 — Applicant dashboard and application tracking

| Feature | Status | Where |
|---|---|---|
| Profile information | ✓ | `src/app/portal/page.tsx` |
| Application reference | ✓ | Shown on the dashboard, register and detail |
| Submitted details | ✓ | `src/app/portal/applications/[id]` |
| Document status | ✓ | `src/app/portal/documents` |
| Application completeness | ✓ | `ProgressBar` driven by `computeCompleteness` |
| Screening status | ✓ | Status badge, officer remarks and correction requests |
| Examination and interview status | ✓ | Examination number, centre, seat, date; interview slot, venue and panel |
| Recruitment outcome | ✓ | Shown once the selection list is approved |
| Notifications | ✓ | `src/app/portal/notifications` |
| Application history | ✓ | `ApplicationStatusHistory` timeline |
| **Use case: tracking an application** | ✓ | Applicant signs in and opens the dashboard → current status and updates shown → where action is required, instructions are displayed → notifications arrive as authorised status changes occur |
| Tracking without signing in | ✓ | `src/app/(public)/track` — reference plus surname; a mismatch discloses nothing |

### Module 4 — Commission administrative management

| Feature | Status | Where |
|---|---|---|
| Department and unit directory | ✓ | `src/app/admin/content/departments`; `Department` with a parent hierarchy |
| Administrative staff accounts | ✓ | `src/app/admin/users/**` |
| Internal task assignment | ✓ | `src/app/admin/records/tasks`; `StaffTask` |
| Correspondence and enquiry records | ✓ | `src/app/admin/records/correspondence`; `src/app/admin/enquiries` |
| Document repository | ✓ | `src/app/admin/records/repository`; `RepositoryDocument` |
| Approved circulars and notices | ✓ | Module 1 content management |
| Workflow tracking | ✓ | Task status, correspondence status, `ApprovalRequest` |
| Records classification | ✓ | General, confidential, restricted — restricted records are withheld from roles without rights |
| Search and retrieval | ✓ | Search and filters on every register |
| Exact functions confirmed during requirements analysis | ◐ | The proposal defers the detail; the model is extensible |

### Module 5 — User, role and access management

All eleven user categories from the proposal are implemented in `src/lib/constants.ts` and
`src/lib/rbac.ts`:

Super Administrator · Commission Administrator · Recruitment Director/Coordinator ·
Recruitment Officer · Screening Officer · Document Verification Officer · Examination Officer ·
Interview Panel Member · Public Relations/Portal Content Officer · Management and Reporting
Officer · Applicant

| Feature | Status | Where |
|---|---|---|
| Account creation | ✓ | `createStaffUser`; temporary password emailed, change forced at first sign-in |
| Role assignment | ✓ | `updateStaffUser`; role changes are audited |
| Permissions | ✓ | 30 named permissions; role defaults plus per-user grants (`UserPermission`) |
| Activation / deactivation | ✓ | `updateStaffUser`; deactivation revokes live sessions |
| Password management | ✓ | `resetStaffPassword`, `changePassword`, `unlockAccount` |
| Login history | ✓ | `LoginHistory`, shown on the account page |
| Access restrictions | ✓ | `src/lib/page-guards.ts` (pages), `requirePermission` (actions and APIs), `visibleNav` (navigation) |
| Audit trails | ✓ | `src/lib/audit.ts` |
| Users access only their assigned functions | ✓ | Navigation hides what the role lacks; a direct URL is refused with a clear explanation and the attempt is logged |

### Module 6 — Management dashboard and reporting

| Report | Status | Where |
|---|---|---|
| Total, active and closed recruitment exercises | ✓ | `dashboardSummary` |
| Total applications | ✓ | `dashboardSummary` |
| Applications by vacancy | ✓ | `applicationsByVacancy` |
| Applications by qualification | ✓ | `applicationsByQualification` |
| Applications by LGA | ✓ | `applicationsByLga` |
| Gender statistics where lawfully collected and approved | ◐ | `applicationsByGender`; collection is a Commission setting (`dataProtection.collectGender`) and the report states the basis |
| Complete and incomplete applications | ✓ | `dashboardSummary` |
| Applications awaiting screening | ✓ | `dashboardSummary` |
| Shortlisted candidates | ✓ | `dashboardSummary` |
| Examination and interview candidates | ✓ | `dashboardSummary` |
| Successful and unsuccessful candidates | ✓ | `dashboardSummary` |
| Recruitment stage completion statistics | ✓ | `dashboardSummary().stageCompletion` |
| Filtering | ✓ | By exercise on every report; by status, vacancy and search on registers |
| Printing | ✓ | Print stylesheet in `globals.css`; PDF export |
| Export to PDF and Excel | ✓ | `src/lib/export.ts`; CSV also provided |
| **Use case: generating a recruitment report** | ✓ | Authorised user opens the reporting module → chooses an exercise and parameters → summary statistics are displayed → the report is generated, printed or exported according to the user's permissions, and the export is audited |

### Module 7 — Notification and communication

| Notification | Status | Where |
|---|---|---|
| Application acknowledgement | ✓ | `APPLICATION_ACKNOWLEDGEMENT` |
| Status updates | ✓ | `APPLICATION_STATUS_UPDATE` |
| Examination invitations | ✓ | `EXAM_INVITATION` |
| Interview invitations | ✓ | `INTERVIEW_INVITATION` |
| Document correction requests | ✓ | `DOCUMENT_CORRECTION_REQUEST` |
| Recruitment announcements | ✓ | `RECRUITMENT_ANNOUNCEMENT`; notification batches |
| Password resets | ✓ | `PASSWORD_RESET` |
| Administrative alerts | ✓ | `ADMIN_ALERT` |
| Shortlist and outcome notifications | ✓ | `SHORTLIST_NOTIFICATION`, `SELECTION_SUCCESSFUL`, `SELECTION_UNSUCCESSFUL` |
| Email delivery | ✓ | Nodemailer over SMTP, with an HTML Commission template |
| SMS through an approved gateway | ◐ | `deliverSms`; provider configured by environment. **Transaction charges are separate unless expressly included in the final contract** |
| Delivery records retained where supported | ✓ | `Notification.status`, `.sentAt`, `.providerRef`, `.error` |
| Editable message templates | ✓ | `src/app/admin/notifications/templates` |
| **Use case: sending an interview invitation** | ✓ | The administrator selects approved candidates → prepares the message with date, time and venue → the message is reviewed and approved → notifications are sent through the configured channels and delivery records retained |

### Module 8 — Audit trail and activity monitoring

| Logged activity | Status | Where |
|---|---|---|
| Login and logout | ✓ | `LOGIN`, `LOGOUT`, `LOGIN_FAILED`; `LoginHistory` |
| Application submissions | ✓ | `APPLICATION_SUBMITTED` |
| Document uploads and modifications | ✓ | `DOCUMENT_UPLOADED`, `DOCUMENT_REVIEWED`, `DOCUMENT_DELETED`, `DOCUMENT_VIEWED` |
| Screening decisions | ✓ | `SCREENING_RECORDED`, `SCREENING_ASSIGNED` |
| Candidate status changes | ✓ | `APPLICATION_STATUS_CHANGED` plus `ApplicationStatusHistory` |
| Approvals | ✓ | `EXERCISE_APPROVED`, `SHORTLIST_APPROVED`, `SELECTION_APPROVED` |
| Administrative changes | ✓ | `SETTINGS_UPDATED`, `RECORD_CREATED`, `RECORD_UPDATED` |
| User account changes | ✓ | `USER_CREATED`, `ROLE_CHANGED`, `PERMISSIONS_CHANGED`, `USER_DEACTIVATED` |
| Logs identify the user, date and time | ✓ | `AuditLog.userId`, `actorName`, `actorRole`, `createdAt`, `ipAddress` |
| Sensitive records restricted to authorised officers | ✓ | `AuditLog.sensitive`; filtered unless the officer holds `audit.view.sensitive` |
| Audit records cannot be edited or deleted from the portal | ✓ | No update or delete path exists |

---

## 6. End-to-end recruitment workflow

All ten stages are modelled in `WORKFLOW_STAGES` (`src/lib/constants.ts`), enforced by
`src/lib/workflow.ts`, and shown to applicants as a stage tracker.

| Stage | Status | Enforced by |
|---|---|---|
| 1 Recruitment planning | ✓ | `createExercise`, `createVacancy` |
| 2 Vacancy publication | ✓ | `changeExerciseStatus` → approved → published |
| 3 Applicant registration | ✓ | `registerApplicant`, `saveProfile` |
| 4 Application submission | ✓ | `submitApplication`; blocked until complete |
| 5 Preliminary screening | ✓ | `assignScreening`, `recordScreening`, `reviewDocument` |
| 6 Shortlisting | ✓ | `createShortlist`, `decideShortlist` |
| 7 Examination and assessment | ✓ | `createExamSchedule` … `validateExamScores` |
| 8 Interview | ✓ | `createInterviewSchedule` … `consolidateInterviews` |
| 9 Final selection | ✓ | `createSelectionList`, `decideSelectionList` |
| 10 Closure and archiving | ✓ | `archiveSelectionList`; notifications sent, records archived, reports available |

Illegal transitions are refused: an exercise cannot be published without approval, an application
cannot skip screening, and a candidate cannot be selected without assessment. See
`tests/workflow.test.ts`.

---

## 7. Non-functional and technical requirements

### 7.1 Security

| Requirement | Status | Where |
|---|---|---|
| Secure authentication and role-based access control | ✓ | `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/page-guards.ts` |
| Secure password storage | ✓ | bcrypt, cost 10; never logged or returned |
| Session management | ✓ | Signed HTTP-only cookies, server-side session records, revocation, expiry |
| HTTPS-encrypted communication | ◐ | Enforced at the hosting layer; `secure` cookies in production. See `docs/DEPLOYMENT.md` |
| Secure document storage | ✓ | Outside the web root; served only through authorisation-checked routes |
| Protection against common web vulnerabilities | ✓ | Parameterised queries (Prisma); Zod validation on every input; escaped content rendering; magic-byte upload checks; path-traversal guard; same-site cookies; account lock-out |
| Administrative activity logging | ✓ | `src/lib/audit.ts` |
| Appropriate data protection controls | ✓ | Access by role, sensitive-record restriction, logged document access |

### 7.2 Performance and scalability

| Requirement | Status | Where |
|---|---|---|
| Support concurrent users per agreed hosting capacity | ◐ | Stateless application servers; capacity agreed in technical design |
| Efficient application processing | ✓ | Aggregate queries in `src/lib/reports.ts`; pagination on every large register |
| Optimised database queries | ✓ | 30 indexes in `prisma/schema.prisma`; `groupBy` aggregates rather than row scans |
| Scalable architecture | ✓ | Datasource switchable to PostgreSQL; no server-side session affinity |
| Responsive on desktop, tablet and mobile | ✓ | Tailwind responsive layouts; verified with no horizontal overflow at 390px |

### 7.3 Data management

| Requirement | Status | Where |
|---|---|---|
| Centralised database and structured applicant records | ✓ | `prisma/schema.prisma` |
| Secure document repository | ✓ | `src/lib/storage.ts`, `RepositoryDocument` |
| Data validation | ✓ | `src/lib/validation.ts` |
| Duplicate record detection | ✓ | Unique constraints on email, references, examination numbers, and one application per applicant, exercise and vacancy |
| Search and retrieval | ✓ | Search on every register |
| Authorised data export | ✓ | `report.export` permission; every export audited |
| Backup and restoration procedures | ◐ | Operational; documented in `docs/DEPLOYMENT.md` |

### 7.4 Availability and business continuity

| Requirement | Status | Where |
|---|---|---|
| Reliable hosting environment | ◐ | Agreed with the Kogi State Government at project initiation |
| Scheduled database backups | ◐ | Procedure in `docs/DEPLOYMENT.md` |
| Recovery procedures | ◐ | Procedure in `docs/DEPLOYMENT.md` |
| System availability monitoring | ✓ | `GET /api/health` reports database reachability and latency |
| Documented maintenance procedures | ✓ | `docs/DEPLOYMENT.md` |

### 7.5 Data protection and privacy

| Requirement | Status | Where |
|---|---|---|
| Designed to support the Nigeria Data Protection Act 2023 | ✓ | `docs/DATA-PROTECTION.md` |
| The Commission determines lawful bases, retention, authorisations and notices | ✓ | `src/app/admin/settings` (data protection group); privacy notice is Commission-editable content |
| Applicant information not publicly accessible merely because it was submitted | ✓ | No public route exposes applicant data; public tracking requires reference **and** surname and returns only that applicant's own progress; documents require authorisation and every officer access is logged |

---

## 10. Project deliverables

| Deliverable | Status |
|---|---|
| Fully developed Commission portal | ✓ |
| Public-facing institutional website and secure administrative backend | ✓ |
| Integrated Civil Service Recruitment Management System | ✓ |
| Applicant registration, dashboard and online application module | ✓ |
| Digital document management, screening and shortlisting modules | ✓ |
| Examination, assessment and interview management facilities | ✓ |
| Recruitment outcome and reporting module | ✓ |
| User and role management, notifications and audit trail | ✓ |
| Configured production deployment | ◐ Build verified; environment-specific deployment per `docs/DEPLOYMENT.md` |
| Administrator and user training | ◐ Delivered as a service; materials in `docs/ADMINISTRATOR-MANUAL.md` and `docs/USER-MANUAL.md` |
| User and system administration manuals and technical documentation | ✓ `docs/` and `README.md` |
| System testing and deployment report | ✓ `docs/TESTING-REPORT.md`, `docs/DEPLOYMENT.md` |
| Post-deployment support | ◐ Per the agreed 12-month warranty period (proposal §12) |

---

## 14. Scope boundaries honoured in the build

- The system supports recruitment administration and records; it does not independently determine
  legal eligibility. `runAutoChecks` only suggests an outcome — the decision is recorded against
  the deciding officer.
- Final approval of successful candidates rests with the legally authorised government
  authorities. This is stated on the selection page and in the successful-candidate notification.
- External identity, certificate, payment, SMS, email, examination and government database
  integrations are subject to technical access and agreed scope. Email and SMS ship with
  configurable providers; the others are not assumed.
- Major additions outside the approved specification are change requests.
