'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { enquirySchema, parseForm } from '@/lib/validation';
import { enquiryReference } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendNotification, CHANNELS } from '@/lib/notifications';
import { COMMISSION } from '@/lib/constants';

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  data?: Record<string, unknown>;
}

/** Module 1 - public enquiry submission. */
export async function submitEnquiry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(enquirySchema, formData);
  const values = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    subject: String(formData.get('subject') ?? ''),
    message: String(formData.get('message') ?? ''),
  };
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, values, message: 'Please correct the highlighted fields.' };
  }

  const reference = enquiryReference();
  const enquiry = await prisma.enquiry.create({
    data: {
      reference,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.ENQUIRY_RECEIVED,
    entityType: 'Enquiry',
    entityId: enquiry.id,
    summary: `Public enquiry ${reference} received from ${parsed.data.name}`,
  });

  await sendNotification({
    channel: CHANNELS.EMAIL,
    toAddress: parsed.data.email,
    subject: `Enquiry received — ${reference}`,
    body: `Dear ${parsed.data.name},\n\nThank you for contacting the ${COMMISSION.name}.\n\nYour enquiry has been logged with reference ${reference}. A Commission officer will respond to you in due course.\n\nSubject: ${parsed.data.subject}\n\n${COMMISSION.name}`,
  });

  return {
    ok: true,
    message: `Your enquiry has been received. Your reference number is ${reference}. A confirmation has been sent to ${parsed.data.email}.`,
  };
}

/** Public application tracking by reference (Module 3). */
export async function trackApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reference = String(formData.get('reference') ?? '').trim();
  const surname = String(formData.get('surname') ?? '').trim();

  if (!reference || !surname) {
    return {
      ok: false,
      message: 'Enter both your application reference and your surname.',
      values: { reference, surname },
    };
  }

  const application = await prisma.application.findFirst({
    where: { reference: { equals: reference } },
    include: {
      exercise: { select: { title: true, reference: true, status: true } },
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
      applicant: { select: { applicantProfile: { select: { surname: true, firstName: true } } } },
      documents: { select: { reviewStatus: true } },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      examCandidates: {
        select: {
          examNumber: true, attendance: true,
          schedule: { select: { title: true, examDate: true, startTime: true, resultsPublishedAt: true } },
          centre: { select: { name: true, address: true } },
        },
      },
      interviewCandidates: {
        select: {
          attendance: true, slotTime: true,
          schedule: { select: { title: true, interviewDate: true, venue: true, startTime: true } },
        },
      },
    },
  });

  const profile = application?.applicant.applicantProfile;
  if (!application || !profile || profile.surname.toLowerCase() !== surname.toLowerCase()) {
    await recordAudit({
      action: 'APPLICATION_TRACK_FAILED',
      entityType: 'Application',
      summary: `Failed public tracking attempt for reference ${reference}`,
    });
    return {
      ok: false,
      message:
        'No application matches that reference and surname. Check the details on your acknowledgement and try again.',
      values: { reference, surname },
    };
  }

  const exam = application.examCandidates[0];
  const interview = application.interviewCandidates[0];

  return {
    ok: true,
    data: {
      reference: application.reference,
      applicantName: `${profile.firstName} ${profile.surname}`,
      exerciseTitle: application.exercise.title,
      exerciseReference: application.exercise.reference,
      position: application.vacancy
        ? `${application.vacancy.jobTitle} (${application.vacancy.gradeLevel})`
        : 'Not selected',
      status: application.status,
      stage: application.stage,
      completeness: application.completeness,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      documentsTotal: application.documents.length,
      documentsVerified: application.documents.filter((d) => d.reviewStatus === 'VERIFIED').length,
      documentsRejected: application.documents.filter((d) =>
        ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus),
      ).length,
      shortlisted: application.shortlisted,
      examNumber: exam?.examNumber ?? null,
      examTitle: exam?.schedule.title ?? null,
      examDate: exam?.schedule.examDate?.toISOString() ?? null,
      examTime: exam?.schedule.startTime ?? null,
      examCentre: exam?.centre?.name ?? null,
      examScore:
        exam && exam.schedule.resultsPublishedAt ? (application.examScore ?? null) : null,
      interviewTitle: interview?.schedule.title ?? null,
      interviewDate: interview?.schedule.interviewDate?.toISOString() ?? null,
      interviewTime: interview?.slotTime ?? interview?.schedule.startTime ?? null,
      interviewVenue: interview?.schedule.venue ?? null,
      history: application.statusHistory.map((h) => ({
        toStatus: h.toStatus,
        remarks: h.remarks,
        createdAt: h.createdAt.toISOString(),
      })),
    },
  };
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? null,
    userAgent: h.get('user-agent') ?? null,
  };
}
