import type {
  CommunicationChannel,
  MarkEntryStatus,
  ResultPackStatus,
  SchoolRole,
  SchoolSector
} from './types';

export function formatSchoolRole(role: SchoolRole): string {
  switch (role) {
    case 'SCHOOL_ADMIN':
      return 'School Administrator';
    case 'HEAD_TEACHER':
      return 'Head Teacher';
    case 'DEPUTY_HEAD':
      return 'Deputy Head';
    case 'TEACHER':
      return 'Subject Teacher';
    case 'PARENT_GUARDIAN':
      return 'Parent / Guardian';
    case 'STUDENT':
      return 'Student';
  }
}

export function formatSchoolSector(sector: SchoolSector): string {
  switch (sector) {
    case 'GOVERNMENT':
      return 'Government School';
    case 'PRIVATE':
      return 'Private School';
    case 'COMMUNITY':
      return 'Community School';
  }
}

export function formatPackStatus(status: ResultPackStatus): {
  label: string;
  tone: 'neutral' | 'warning' | 'info' | 'approved' | 'published';
  summary: string;
} {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft · Mark Entry',
        tone: 'neutral',
        summary: 'Allocated teachers are entering subject marks. Not yet submitted for review.'
      };
    case 'NEEDS_REVISION':
      return {
        label: 'Returned for Revision',
        tone: 'warning',
        summary: 'Returned by school leadership with revision notes for teacher correction.'
      };
    case 'SUBMITTED':
      return {
        label: 'Submitted for Review',
        tone: 'info',
        summary: 'All expected marks are recorded. Awaiting leadership review and Head Teacher approval.'
      };
    case 'APPROVED':
      return {
        label: 'Approved · Unpublished',
        tone: 'approved',
        summary:
          'Approved by Head Teacher. Printable staff previews are ready, but results remain hidden from parents until published.'
      };
    case 'PUBLISHED':
      return {
        label: 'Published',
        tone: 'published',
        summary: 'Officially published for printable report cards and authorised parent access.'
      };
  }
}

export function formatChannelLabel(channel: CommunicationChannel): string {
  switch (channel) {
    case 'PRINT_REPORT':
      return 'Printed A4 Report Card (No smartphone required)';
    case 'SMS_SUMMARY':
      return 'Printed Report + Feature-Phone SMS Summary (Planned)';
    case 'GUARDIAN_PORTAL':
      return 'Printed Report + Guardian Account';
  }
}

export function validateDraftMarkInput(
  status: MarkEntryStatus,
  rawScore: string,
  maxMark: number
): { valid: true; score: number | null } | { valid: false; error: string } {
  const trimmed = rawScore.trim();

  if (status !== 'PRESENT') {
    if (trimmed.length > 0) {
      return {
        valid: false,
        error: 'Clear the numeric score when status is Pending, Absent, or Exempt.'
      };
    }
    return { valid: true, score: null };
  }

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Enter a whole-number score when status is Present.'
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Score must be a whole number without decimals.'
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxMark) {
    return {
      valid: false,
      error: `Score must be between 0 and ${maxMark}.`
    };
  }

  return { valid: true, score: parsed };
}

export function formatCompletenessRatio(recorded: number, expected: number): {
  percent: number;
  label: string;
} {
  if (expected <= 0) {
    return { percent: 0, label: 'No subject allocations configured' };
  }
  const bounded = Math.min(Math.max(recorded, 0), expected);
  const percent = Math.round((bounded / expected) * 100);
  const missing = expected - bounded;
  return {
    percent,
    label:
      missing === 0
        ? `${bounded} / ${expected} entries complete`
        : `${bounded} / ${expected} recorded (${missing} missing)`
  };
}
