import crypto from 'node:crypto';
import type { MarkEntryStatus } from './repository.js';

// Unambiguous uppercase alphabet (omits 0, O, 1, I) so students on small screens
// or paper slips do not misread characters.
const ENROLMENT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generatePlainEnrolmentCode(): string {
  const bytes = crypto.randomBytes(8);
  let chars = '';
  for (let i = 0; i < 8; i += 1) {
    chars += ENROLMENT_ALPHABET[bytes[i]! & 31]!;
  }
  return `ORQ-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function normalizeEnrolmentCode(rawCode: string): string {
  return rawCode.toUpperCase().replace(/[\s-]+/g, '');
}

export function hashEnrolmentCode(rawCode: string): string {
  const canonical = normalizeEnrolmentCode(rawCode);
  return crypto
    .createHash('sha256')
    .update(`orqeli-student-enrolment-v1:${canonical}`, 'utf8')
    .digest('hex');
}

export function formatEnrolmentCodeHint(rawCode: string): string {
  const canonical = normalizeEnrolmentCode(rawCode);
  const tail = canonical.slice(-4).padStart(4, '•');
  return `ORQ-••••-${tail}`;
}

export function computeSubjectGrade(
  status: Exclude<MarkEntryStatus, 'PENDING'>,
  score: number | null,
  maxMark: number
): { percentage: number | null; grade: string } {
  if (status === 'ABSENT') {
    return { percentage: null, grade: 'ABS' };
  }
  if (status === 'EXEMPT') {
    return { percentage: null, grade: 'EX' };
  }
  if (score === null || maxMark <= 0) {
    return { percentage: null, grade: '—' };
  }

  const percentage = Math.round((score / maxMark) * 1000) / 10;
  if (percentage >= 75) {
    return { percentage, grade: 'Distinction (1)' };
  }
  if (percentage >= 65) {
    return { percentage, grade: 'Merit (2)' };
  }
  if (percentage >= 50) {
    return { percentage, grade: 'Credit (3)' };
  }
  if (percentage >= 40) {
    return { percentage, grade: 'Pass (4)' };
  }
  return { percentage, grade: 'Unsatisfactory (9)' };
}
