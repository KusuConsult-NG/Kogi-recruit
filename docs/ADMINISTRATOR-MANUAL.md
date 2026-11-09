# Administrator Manual

Kogi State Civil Service Commission Portal — guide for Commission officers

---

## 1. Signing in and what you will see

Sign in at `/login` with your Commission email address. You are taken to the administration
dashboard.

**You see only the functions your role assigns.** The sidebar lists only what you may use; opening
a restricted page directly produces a clear refusal that explains your role's coverage, and the
attempt is recorded in the audit trail.

A temporary password is emailed when your account is created. You must change it the first time
you sign in. Change it at any time from **Password** in the header.

After five failed attempts an account is locked for fifteen minutes. A Commission Administrator
can unlock it.

---

## 2. The roles

| Role | What it can do |
|---|---|
| **Super Administrator** | Everything, including user and system administration |
| **Commission Administrator** | All recruitment and content functions, user management, settings, full audit trail |
| **Recruitment Director / Coordinator** | Create and **approve** exercises, shortlists and selection lists; manage examinations and interviews; reporting; notifications |
| **Recruitment Officer** | Create and configure exercises; assign screening; **prepare** shortlists and selection lists; manage examinations and interviews; reporting |
| **Screening Officer** | Screen assigned applications; review documents; view reports |
| **Document Verification Officer** | Verify applicant documents; view applications and reports |
| **Examination Officer** | Create examinations and centres; allocate candidates; record and validate scores |
| **Interview Panel Member** | Record interview scores for candidates on **their own panel** |
| **Public Relations / Content Officer** | Manage portal content and public enquiries |
| **Management and Reporting Officer** | Dashboards, reports, exports and the audit trail — read only |

Separation of duties is deliberate: the officer who **prepares** a shortlist or selection list is
not the officer who **approves** it, and an officer who manages interviews does not score
candidates unless they sit on the panel.

---

## 3. Stage 1 — Planning a recruitment exercise

**Recruitment Exercises → New exercise** *(Recruitment Officer, Director, Commission
Administrator)*

1. Enter the **title**, a **reference** (leave blank to generate one) and the **description** that
   applicants will read.
2. Enter the **eligibility criteria** and **application guidelines**. Headings (`## `), bullet
   lists (`- `), numbered lists and `[links](https://…)` are supported.
3. Set the **opening and closing dates and times**. The portal opens and closes automatically.
4. Set how many **applications each applicant** may submit — usually one.
5. Tick whether the exercise includes a **written examination** and an **interview**.

### Adding approved vacancies

An exercise cannot be submitted for approval without at least one vacancy.

For each vacancy give the job title, grade level, department or agency, the number of approved
posts, the qualification requirements, the experience requirements and any age limits.

> Name the qualifications explicitly — "A degree (B.Sc) in Accounting" rather than "a relevant
> qualification". The preliminary checks that assist screening officers read these words.
>
> State experience as a number of years — "minimum of 3 years post-qualification experience".

A vacancy with applications against it is deactivated rather than deleted, so the records survive.

### Configuring required documents

Five documents are required by default: passport photograph, birth certificate, NIN evidence,
educational certificate and certificate of State or LGA of origin. Add, remove or amend them,
setting for each whether it is mandatory, the guidance note, the maximum size and the formats
accepted.

### Custom application questions

The standard form already captures personal details, contact information, State and LGA,
qualifications, employment history, referees, next of kin, declaration and consent. Add further
questions only where this exercise needs them: give a field key, the label applicants see, the
input type, whether it is mandatory and, for a list, the options.

---

## 4. Stage 2 — Approval and publication

1. The preparing officer selects **Submit for approval**. An approval request is raised.
2. A Director or Commission Administrator reviews it under **Approvals** or on the exercise, then
   **Approve exercise** — or **Return to draft** with a reason.
3. The approver then selects **Publish to the portal**. The exercise becomes publicly visible and
   opens for applications on its opening date.

Other lifecycle actions:

| Action | Effect |
|---|---|
| **Suspend exercise** | Temporarily stops applications. A reason is required and is shown publicly |
| **Close applications** | No further applications accepted. Processing continues |
| **Archive records** | Records retained, the exercise becomes read-only |

An exercise cannot be published without approval, and a closed or archived exercise cannot be
edited.

---

## 5. Stages 3–4 — Applications arriving

**Applications** lists everything received, filterable by exercise, status and search, and
exportable to Excel.

Open an application to see the applicant's full details, qualifications, employment history,
documents, referees, next of kin, additional answers, scores and complete status history.

---

## 6. Stage 5 — Document verification

**Document Verification** *(Document Verification Officer, Screening Officer, Director)*

The queue shows every document awaiting review, oldest first, filterable by exercise.

For each document: open it, check it against the requirement, then record the outcome.

| Outcome | Effect |
|---|---|
| **Verify** | The document is accepted |
| **Request correction** | The applicant is told what to correct and may re-upload |
| **Reject** | The document is refused |

**A reason is required** unless you are verifying, and the applicant sees it. Write something they
can act on: "The certificate is not legible. Upload a clearer scan showing the certificate number
and the awarding institution."

Every review is retained in the document's history, and every officer who opens an applicant
document is recorded in the audit trail.

---

## 7. Stage 5 — Screening

**Screening** *(Screening Officer, Recruitment Officer, Director)*

### Assigning work

On the **Screening queue** tab, select applications and assign them to a screening officer. The
list shows each officer's outstanding workload. Assigned applications move to *under screening*.

### Screening one application

Open the application. **Preliminary automated checks** show, with the reason for each:

- application completeness;
- required documents attached and none rejected;
- minimum qualification, by comparing what the applicant holds against the vacancy;
- minimum experience, from the employment history;
- age eligibility against the vacancy's limits.

A check marked *review* is advisory — the vacancy set no limit, or its wording could not be
matched. A suggested outcome is offered.

**These checks assist you. The decision is yours and is recorded against your name.**

Record your assessment by ticking what you have satisfied yourself about, choosing the outcome and
writing your remarks.

| Outcome | Effect |
|---|---|
| **Passed** | *Qualified*. Eligible for shortlisting |
| **Correction required** | Returns to the applicant with your remarks |
| **Failed** | *Disqualified*, with your reason recorded |

**Remarks are required** when failing or requesting a correction, and the applicant sees them.

### Bulk screening

Select several applications and record one outcome for all of them. Every applicant is notified.
Use it for straightforward cases only; anything needing judgement should be screened individually.

---

## 8. Stage 6 — Shortlisting

1. On **Screening → Ready to shortlist**, choose a single exercise, select the qualified
   candidates, give the shortlist a title and create it. It is created as a draft.
2. The preparing officer reviews it under **Shortlists** and removes anyone who should not be
   there, then selects **Submit for approval**.
3A Director or Commission Administrator approves it. Every candidate is then marked
   *shortlisted* and notified by email and SMS — or the list is returned with a reason.

A shortlist can be exported to PDF for the Commission's records.

---

## 9. Stage 7 — Examination

**Examinations** *(Examination Officer, Director)*

### Creating an examination

Give the title, date, reporting time, end time, total marks, pass mark and the instructions
candidates will receive.

### Adding centres

For each centre give the name, address, LGA, capacity and supervisor. **At least one centre is
required** before candidates can be allocated. Setting the LGA matters: candidates are allocated
to a centre in their own LGA first, while capacity allows.

### Allocating candidates

Select the approved shortlisted candidates and allocate them. Each receives a unique
**examination number** and a seat number, and — if you leave the notify box ticked — an invitation
by email and SMS with the date, reporting time, centre and address.

Capacity is never exceeded. Any candidate who cannot be placed is reported so you can add
capacity.

### Recording attendance and scores

Either record each candidate individually — attendance, score and any remarks — or upload a score
sheet in bulk.

**Bulk upload** accepts a CSV of `examination number, score, optional remarks`, attached or pasted.
A header row is detected. Every line is validated: out-of-range scores and unmatched examination
numbers are reported with their line numbers, and valid rows are still applied.

### Validating and releasing

**Validate scores and advance candidates** requires attendance for every candidate and a score for
everyone marked present. It moves candidates to *examination completed*. Tick **Release scores**
to let candidates see their own score on their dashboard.

Results export to PDF with the candidate list, centre allocation and performance summary.

---

## 10. Stage 8 — Interview

**Interviews** *(Director, Recruitment Officer; panel members see their own interviews)*

### Creating an interview

Give the title, date, start and end time, venue, minutes per candidate, total marks and pass mark.

### The assessment framework

The default framework totals 100 marks: job knowledge (30), communication (20), analytical ability
(20), conduct (15) and overall suitability (15). Amend the criteria and their maxima for this
interview; the total adjusts automatically.

### Panels

Create each panel with a name, room and members, designating a chair. **At least one panel is
required** before candidates can be scheduled.

### Scheduling candidates

Select the candidates and schedule them. They are spread evenly across the panels, each given a
time slot from the start time and the minutes per candidate, and notified with the date, time and
venue.

### Recording scores

**Only members of a candidate's own panel may score them.** Each member records their own sheet:
a score per criterion, within its maximum, plus remarks. The panel mean is shown as each member
records their assessment.

### Consolidating

**Consolidate panel assessments** requires attendance for every candidate and at least one panel
score for everyone present. It records the panel mean against each candidate and advances them.

---

## 11. Stages 9–10 — Final selection, outcome and archiving

**Final Selection** *(Recruitment Officer prepares; Director or Commission Administrator approves)*

### Preparing the list

Choose the exercise, give the list a title and set the **examination and interview weighting** —
50/50 by default.

The system then:

- combines each candidate's examination and interview scores using that weighting;
- ranks every candidate by their final score, equal scores sharing a rank;
- fills each vacancy's approved number of posts by rank, marking the remainder **reserve**.

### Reviewing and adjusting

Review the ranking and the vacancy fill. Change any provisional outcome — selected, reserve, not
selected — and record remarks. Every candidate must have an outcome before submission.

### Approval

The preparing officer submits the list; an authorised officer approves it. On approval:

- successful candidates are marked **selected** and told they have been recommended for
  appointment;
- unsuccessful candidates are notified;
- the approving officer and the date are recorded.

**This cannot be undone.** Final appointment remains subject to the approval of the legally
authorised government authorities.

### Closure

**Archive records and close exercise** concludes stage 10. Records are retained and the exercise
is closed to further applications. Export the selection list to PDF and Excel for the Commission's
records.

---

## 12. Portal content

**Content Officer, Commission Administrator**

| Area | What it controls |
|---|---|
| **News & Notices** | News, announcements, circulars, public notices and recruitment notices |
| **Institutional Pages** | Homepage, profile, mandate, functions, vision, recruitment process, privacy notice |
| **Leadership** | Approved leadership profiles |
| **Departments & Units** | The directory, also used for staff accounts and vacancies |
| **Downloads** | Approved forms, guidelines, publications and circulars |
| **FAQs** | The public questions and answers |

An item is created as a draft. An officer without publishing rights submits it for approval; an
officer with publishing rights publishes it directly. Published items can be unpublished or
archived. Attachments up to 10MB can be added. The publishing officer, date and time are recorded.

### Public enquiries

**Public Enquiries** lists everything submitted through the contact form, each with a reference.
Record a response and set the status; choosing *Responded* emails the enquirer. The response
history is retained.

---

## 13. Commission administration

**Internal Tasks** — assign work with a priority, department, assignee and due date. Overdue tasks
are highlighted.

**Correspondence** — log incoming and outgoing correspondence with a reference, party,
classification (general, confidential, restricted) and status.

**Document Repository** — file Commission records with a classification, category and tags.
Restricted records are hidden from roles without rights to them, and every access is logged.

---

## 14. Reports and analytics

**Reports and Analytics** *(any role with reporting rights)*

Choose a single exercise or report across the whole portal. The page shows exercise counts,
application counts, stage completion, document progress, and distributions by vacancy,
qualification, LGA, gender, department and status, plus the vacancy fill rate.

> Gender statistics are collected and reported only where lawfully permitted and approved by the
> Commission. The setting is under **Settings → Data protection**.

Export the full recruitment report, the application register or the audit trail to **PDF, Excel or
CSV**. Exports need the export permission, and every export is recorded in the audit trail
against your account.

The application register contains applicant personal information. Handle it as restricted.

---

## 15. Notifications

**Notifications** *(officers with sending rights)*

**Prepare a batch** — choose the audience by exercise and application status, the channel, the
subject and the message. Use `{{name}}` to insert each recipient's name. The batch is prepared with
its recipient count; an officer with approval rights approves and sends it, or rejects it.

**Message a single applicant** — a one-off email, SMS or both.

**Delivery history** shows every message with its status, the time it was sent, and the reason for
any failure.

**Message Templates** *(approval rights)* — the wording of every automated notification:
acknowledgements, status updates, correction requests, shortlist notifications, examination and
interview invitations, outcome letters, password resets and staff account notices. An edited
template overrides the system default; **Reset to default** restores it. The available variables
are listed under each template.

> SMS is delivered through the approved gateway configured for the environment. **SMS transaction
> charges are separate** unless expressly included in the final contract.

---

## 16. Users, roles and access

**Users & Roles** *(user management rights)*

### Creating an account

Give the full name, email address, telephone number, role, official title, staff number and
department. A temporary password is emailed and must be changed at first sign-in.

Only a Super Administrator may create or change another Super Administrator.

### Changing a role

Changing a role changes what the officer can do immediately and is recorded in the audit trail.
The system will not leave the Commission without at least one active Super Administrator.

### Additional permissions

Each role carries default permissions, shown as *role default* and not removable individually —
change the role instead. Grant a further permission to one officer where their duties require it;
the grant is audited.

### Deactivating an account

Clear **Account is active**. Live sessions are signed out immediately. Accounts are deactivated,
never deleted, so their recorded decisions remain attributable.

### Password resets and unlocking

**Issue a new temporary password** emails a new password, forces a change at next sign-in and signs
out all sessions. A locked account can be unlocked from the account page.

---

## 17. The audit trail

**Audit Trail** *(audit rights)*

Every important activity is logged with the officer, their role, the action, the record affected,
a summary, the IP address and the time: sign-ins and failures, application submissions, document
uploads, reviews and views, screening decisions, status changes, approvals, score entry,
notifications, report exports, account and permission changes, settings changes and refused access
attempts.

Filter by action, officer, record type and date range, and export to PDF, Excel or CSV.

**Sensitive records** — score entry, approvals, password and permission changes — are shown only
to officers holding the sensitive-audit permission. Audit records cannot be edited or deleted from
the portal.

Failed sign-ins over the last seven days are summarised at the top of the page.

---

## 18. Settings

**Settings** *(Super Administrator, Commission Administrator)*

| Group | Contains |
|---|---|
| Commission details | Name, address, email, telephone, office hours |
| Recruitment defaults | Applications per applicant, examination marks and pass mark, interview slot length, default weighting |
| Document handling | Maximum size, days allowed for correction |
| Security and access | Failed attempts before lock-out, lock-out duration, session lifetime |
| Notifications | Default channel, SMS sender identity, email sender address |
| Data protection | Retention period, lawful basis, whether gender statistics are collected, data protection officer |

Every change is recorded in the audit trail. A health endpoint at `/api/health` reports database
reachability and latency for uptime monitoring.

---

## 19. Approvals

**Approvals** collects everything awaiting authorisation — exercises, shortlists, selection lists,
portal content and notification batches — with who requested it and when. **Review** opens the
record itself to approve or return it.

---

## 20. Day-to-day reminders

- **Record a reason.** Any outcome that disadvantages an applicant requires remarks, and the
  applicant sees them. Write something they can act on.
- **Preliminary checks assist; you decide.** Your name is on the decision.
- **Prepare and approve are separate.** Do not ask an approver to prepare the list they will
  approve.
- **Everything is logged.** Including opening an applicant's document.
- **Handle exports carefully.** The application register contains personal information.
- **Tell applicants early.** A correction request at screening is far better than a silent delay.

---

Kogi State Civil Service Commission · restricted administrative area
