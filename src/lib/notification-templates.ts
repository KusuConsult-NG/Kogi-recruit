/**
 * Module 7 - notification template catalogue.
 * Kept free of server-only imports so it can be used by the seed script and tests.
 */

export const CHANNELS = { EMAIL: 'EMAIL', SMS: 'SMS', IN_APP: 'IN_APP', BOTH: 'BOTH' } as const;

export const TEMPLATES = {
  APPLICANT_WELCOME: 'APPLICANT_WELCOME',
  APPLICATION_ACKNOWLEDGEMENT: 'APPLICATION_ACKNOWLEDGEMENT',
  APPLICATION_STATUS_UPDATE: 'APPLICATION_STATUS_UPDATE',
  DOCUMENT_CORRECTION_REQUEST: 'DOCUMENT_CORRECTION_REQUEST',
  SHORTLIST_NOTIFICATION: 'SHORTLIST_NOTIFICATION',
  EXAM_INVITATION: 'EXAM_INVITATION',
  INTERVIEW_INVITATION: 'INTERVIEW_INVITATION',
  SELECTION_SUCCESSFUL: 'SELECTION_SUCCESSFUL',
  SELECTION_UNSUCCESSFUL: 'SELECTION_UNSUCCESSFUL',
  PASSWORD_RESET: 'PASSWORD_RESET',
  ADMIN_ALERT: 'ADMIN_ALERT',
  RECRUITMENT_ANNOUNCEMENT: 'RECRUITMENT_ANNOUNCEMENT',
  ENQUIRY_RESPONSE: 'ENQUIRY_RESPONSE',
  STAFF_ACCOUNT_CREATED: 'STAFF_ACCOUNT_CREATED',
} as const;

export type TemplateCode = (typeof TEMPLATES)[keyof typeof TEMPLATES];


/** Replace {{variable}} placeholders. */
export function render(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export const DEFAULT_TEMPLATES: Record<
  string,
  { name: string; channel: string; subject: string; body: string; variables: string[] }
> = {
  [TEMPLATES.APPLICANT_WELCOME]: {
    name: 'Applicant account created',
    channel: CHANNELS.EMAIL,
    subject: 'Your Kogi State Civil Service Commission portal account',
    body: `Dear {{name}},\n\nYour applicant account has been created successfully.\n\nApplicant reference: {{applicantRef}}\nEmail: {{email}}\n\nYou may now sign in to complete your profile and apply for any open recruitment exercise.\n\n{{loginUrl}}\n\nKogi State Civil Service Commission`,
    variables: ['name', 'applicantRef', 'email', 'loginUrl'],
  },
  [TEMPLATES.APPLICATION_ACKNOWLEDGEMENT]: {
    name: 'Application acknowledgement',
    channel: CHANNELS.BOTH,
    subject: 'Application received - {{reference}}',
    body: `Dear {{name}},\n\nYour application to the {{exercise}} recruitment exercise has been received.\n\nApplication reference: {{reference}}\nPosition applied for: {{position}}\nDate submitted: {{submittedAt}}\n\nPlease retain your application reference. You can track the progress of your application at any time from your applicant dashboard.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise', 'position', 'submittedAt'],
  },
  [TEMPLATES.APPLICATION_STATUS_UPDATE]: {
    name: 'Application status update',
    channel: CHANNELS.BOTH,
    subject: 'Update on your application {{reference}}',
    body: `Dear {{name}},\n\nThe status of your application ({{reference}}) for the {{exercise}} exercise has been updated to: {{status}}.\n\n{{remarks}}\n\nSign in to your applicant dashboard for full details.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise', 'status', 'remarks'],
  },
  [TEMPLATES.DOCUMENT_CORRECTION_REQUEST]: {
    name: 'Document correction request',
    channel: CHANNELS.BOTH,
    subject: 'Action required: document correction for {{reference}}',
    body: `Dear {{name}},\n\nOne or more documents attached to your application ({{reference}}) require correction:\n\n{{documents}}\n\nOfficer's remarks: {{remarks}}\n\nPlease sign in and re-upload the affected documents before {{deadline}}.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'documents', 'remarks', 'deadline'],
  },
  [TEMPLATES.SHORTLIST_NOTIFICATION]: {
    name: 'Shortlist notification',
    channel: CHANNELS.BOTH,
    subject: 'You have been shortlisted - {{reference}}',
    body: `Dear {{name}},\n\nFollowing the screening of applications for the {{exercise}} exercise, we are pleased to inform you that you have been shortlisted for the position of {{position}}.\n\nApplication reference: {{reference}}\n\nFurther instructions on the next stage of the exercise will be communicated to you.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise', 'position'],
  },
  [TEMPLATES.EXAM_INVITATION]: {
    name: 'Examination invitation',
    channel: CHANNELS.BOTH,
    subject: 'Examination invitation - {{examNumber}}',
    body: `Dear {{name}},\n\nYou are invited to the written examination for the {{exercise}} recruitment exercise.\n\nExamination number: {{examNumber}}\nDate: {{date}}\nReporting time: {{time}}\nCentre: {{centre}}\nAddress: {{address}}\n\nPlease arrive at least 45 minutes before the reporting time with a valid means of identification and a printed copy of this invitation.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'examNumber', 'exercise', 'date', 'time', 'centre', 'address'],
  },
  [TEMPLATES.INTERVIEW_INVITATION]: {
    name: 'Interview invitation',
    channel: CHANNELS.BOTH,
    subject: 'Interview invitation - {{reference}}',
    body: `Dear {{name}},\n\nYou are invited to an interview for the position of {{position}} in the {{exercise}} recruitment exercise.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nPlease bring the originals of all documents uploaded with your application, together with a valid means of identification.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise', 'position', 'date', 'time', 'venue'],
  },
  [TEMPLATES.SELECTION_SUCCESSFUL]: {
    name: 'Successful candidate notification',
    channel: CHANNELS.BOTH,
    subject: 'Recruitment outcome - {{reference}}',
    body: `Dear {{name}},\n\nFollowing the conclusion of the {{exercise}} recruitment exercise, we are pleased to inform you that you have been recommended for appointment to the position of {{position}}.\n\nApplication reference: {{reference}}\n\nFormal documentation will be issued to you by the Commission. Final appointment remains subject to the approval of the legally authorised government authorities and verification of your credentials.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise', 'position'],
  },
  [TEMPLATES.SELECTION_UNSUCCESSFUL]: {
    name: 'Unsuccessful candidate notification',
    channel: CHANNELS.EMAIL,
    subject: 'Recruitment outcome - {{reference}}',
    body: `Dear {{name}},\n\nThank you for participating in the {{exercise}} recruitment exercise.\n\nAfter careful consideration, your application ({{reference}}) was not successful on this occasion. We encourage you to apply for future opportunities advertised on the Commission portal.\n\nWe appreciate the time and effort you invested in your application.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'exercise'],
  },
  [TEMPLATES.PASSWORD_RESET]: {
    name: 'Password reset',
    channel: CHANNELS.EMAIL,
    subject: 'Password reset request',
    body: `Dear {{name}},\n\nA password reset was requested for your Kogi State Civil Service Commission portal account.\n\nUse the link below to set a new password. The link expires in 60 minutes and may be used once.\n\n{{resetUrl}}\n\nIf you did not request this, you may ignore this message; your password remains unchanged.\n\nKogi State Civil Service Commission`,
    variables: ['name', 'resetUrl'],
  },
  [TEMPLATES.ADMIN_ALERT]: {
    name: 'Administrative alert',
    channel: CHANNELS.EMAIL,
    subject: '{{subject}}',
    body: `{{message}}\n\nKogi State Civil Service Commission portal`,
    variables: ['subject', 'message'],
  },
  [TEMPLATES.RECRUITMENT_ANNOUNCEMENT]: {
    name: 'Recruitment announcement',
    channel: CHANNELS.BOTH,
    subject: '{{subject}}',
    body: `Dear {{name}},\n\n{{message}}\n\nKogi State Civil Service Commission`,
    variables: ['name', 'subject', 'message'],
  },
  [TEMPLATES.ENQUIRY_RESPONSE]: {
    name: 'Enquiry response',
    channel: CHANNELS.EMAIL,
    subject: 'Response to your enquiry {{reference}}',
    body: `Dear {{name}},\n\nThank you for contacting the Kogi State Civil Service Commission.\n\nYour enquiry: {{subject}}\n\nOur response:\n{{response}}\n\nKogi State Civil Service Commission`,
    variables: ['name', 'reference', 'subject', 'response'],
  },
  [TEMPLATES.STAFF_ACCOUNT_CREATED]: {
    name: 'Staff account created',
    channel: CHANNELS.EMAIL,
    subject: 'Your Commission portal administrative account',
    body: `Dear {{name}},\n\nAn administrative account has been created for you on the Kogi State Civil Service Commission portal.\n\nRole: {{role}}\nEmail: {{email}}\nTemporary password: {{password}}\n\nYou will be required to change this password when you first sign in.\n\n{{loginUrl}}\n\nKogi State Civil Service Commission`,
    variables: ['name', 'role', 'email', 'password', 'loginUrl'],
  },
};
