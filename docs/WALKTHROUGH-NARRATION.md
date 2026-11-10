# Walkthrough narration script

A voiceover script for `demo/kogi-csc-walkthrough.mp4`, timed to the recording
produced by `npm run walkthrough`.

The recording runs **8 minutes 53 seconds**. Chapter cards were measured from
the video itself, so the timings below are the real ones rather than estimates.
Pace is about 145 words a minute, which is the rate the word counts assume.

| Part | On screen | Narration |
|---|---|---|
| Opening | 0:00 – 0:08 | 18 words |
| One — The public portal | 0:08 – 1:36 | 210 words |
| Two — Applying for a post | 1:38 – 2:59 | 195 words |
| Three — The Commission at work | 3:01 – 4:35 | 225 words |
| Four — Setting an aptitude test | 4:37 – 5:52 | 180 words |
| Five — A candidate sits the test | 5:54 – 7:09 | 180 words |
| Six — Marking, outcomes and the record | 7:11 – 8:46 | 228 words |
| Close | 8:46 – 8:53 | 17 words |

Each chapter card holds for three seconds. Leave those silent, or let the line
before it run on — do not start a new sentence under a card.

---

## 0:00 — Opening

The Kogi State Civil Service Commission Portal, with its integrated Civil
Service Recruitment Management System.

## 0:08 — Part one: the public portal

This is what a citizen sees.

The homepage opens with the Commission's standing and its register at a glance:
the exercises open for application, the approved posts advertised, the
applications received, and the number of ministries, departments and agencies
recruiting through the Commission.

Below it, the current recruitment exercises. Each states its approved posts, the
employing ministries, and the date applications close.

Vacancies can be browsed by the ministry that carries the post, because a
vacancy in this system is not an abstract advertisement. It belongs to the
ministry, extra-ministerial department, agency, parastatal, board or commission
that holds the approved establishment.

That register is published in full. Each entry carries its statutory mandate,
its accounting officer, its contact details, and the departments inside it.

An exercise opens to its key dates, its eligibility criteria, and the guidance
on how to apply. Then the approved vacancies, each tied to its employing
ministry and the department within it. And the documents an applicant must
upload, with the size and format each will accept.

The ten documented stages of a recruitment exercise are published too, so an
applicant knows what happens after they submit.

News, official announcements, circulars and public notices. Forms and
publications for download. Frequently asked questions. And a tracking service,
so an applicant can follow an application with only a reference and a surname.

## 1:38 — Part two: applying for a post

Registration asks only for what is needed to open an account, and consent to the
privacy notice is explicit and recorded against the applicant.

The account is created, and a unique applicant reference issued.

The profile captures the personal and contact details the Commission requires,
including State and Local Government Area of origin.

Now an application. The open exercises are offered, and a position is chosen
from the approved vacancies, each showing its employing ministry, grade level
and requirements.

The application opens with its own reference and a completeness measure that
rises as the applicant works. Qualifications, employment history, referees and
next of kin are recorded in turn.

Documents are uploaded against the requirements the Commission set for this
exercise. Each upload is checked for file type, for size, and for its real
content, then held outside the web root and served only to those authorised to
see it.

Before submitting, the applicant confirms the declaration and the
data-processing consent.

The dashboard then tracks the application through all ten stages, with every
document, every notification and the full history of the application in one
place.

## 3:01 — Part three: the Commission at work

An officer signs in and sees only what their role permits. There are eleven
roles and thirty named permissions, enforced three times over: on the
navigation, on the page, and on the action itself.

The establishment register is maintained here. Each MDA holds its code, its
mandate, its accounting officer, its approved staff strength, and the
departments that carry posts. Open one, and every vacancy ever raised against it
is listed with the exercise it belonged to.

Recruitment is managed by a standing unit rather than by individuals acting
alone. Officers are assigned to the unit in named roles — coordinator,
secretary, screening lead, examination lead, records officer — and each exercise
is placed under the unit, so responsibility for every stage is on record.
Membership is never overwritten; an officer who leaves is closed off with a
date.

An exercise under management shows its lifecycle, the stages reached, and its
approval history. Its approved vacancies, each raised against an employing MDA.
The documents it requires, and any additional questions configured for it.

Applications can be filtered by exercise, status and stage. Open one, and the
preliminary checks assist the officer — but the decision is always recorded
against the officer who made it, never against the system.

Screening, document verification, and shortlists prepared by one officer and
approved by another.

## 4:37 — Part four: setting an aptitude test

Questions are collected into banks by subject.

An officer sets a question here, marks the correct answer, and records its
marks, its difficulty and its topic. A batch can be imported in plain text
instead, which is quicker where a bank is being built from an existing paper.

The question joins the bank, and is available to every paper that draws on it.

Papers are assembled from those banks. This one draws a fresh random selection
for every candidate — twenty-seven questions across four sections, forty-five
minutes, marked automatically. Because the selection is drawn per candidate and
the options are shuffled, no two candidates sit quite the same paper.

Once candidates have sat a paper, its settings and its sections lock, so the
record of what was asked cannot be altered after the fact. A copy can be taken
for a future examination.

An examination can be centre-based, computer-based or hybrid. An online test
takes a published paper, a window during which it may be started, and the time
allowed once a candidate begins.

Every sitting is then watched live: not started, in progress, submitted.

## 5:54 — Part five: a candidate sits the test

The candidate is told a test is waiting, and the invitation states the
examination number, the time allowed and the window.

The clock runs without stopping once the test begins.

This is the examination hall. One question at a time, the countdown, and a
navigator showing which questions are answered, unanswered or flagged. The
portal navigation is deliberately withheld, so there is nowhere for a candidate
under a clock to wander off to.

Each answer is saved on the Commission's server as the candidate moves on, so a
dropped connection costs nothing already answered.

A question can be flagged and returned to, and the navigator jumps to any
question in the paper.

The candidate works through the paper, and submits.

The submission is acknowledged and the sitting recorded against the examination
number. The score is withheld until the Commission releases the results, which
is the Commission's decision to make, not the system's.

## 7:11 — Part six: marking, outcomes and the record

The officer sees the sitting submitted, and marked automatically.

Each answer was marked as it was saved. On submission the percentage is scaled
onto the examination's total marks, and written to the candidate's examination
record and to the application itself, so the shortlisting and selection workflow
that already existed carries on unchanged. Scores are still validated by an
officer before any result is treated as final.

Interviews are convened with panels, time slots and a configurable assessment
framework, and each panel member scores independently.

Final selection ranks candidates on weighted examination and interview scores,
against the number of posts actually approved, and the list goes to the
Commission for approval.

Management reporting runs across every exercise: computer-based testing
alongside the rest, and distributions by vacancy, by qualification, by Local
Government Area, by gender and by employing ministry. Every report exports to
PDF, Excel and CSV.

And every action in the system is written to the audit trail, with the officer
who took it and the time they took it — sign-ins, submissions, document reviews,
screening decisions, score entry, approvals, exports, and access that was
refused.

Users, roles and per-user permissions are administered here.

## 8:46 — Close

The Kogi State Civil Service Commission Portal. Built, tested, and documented.
