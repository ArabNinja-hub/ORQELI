/**
 * Seeds clearly labelled synthetic demonstration records into a local development
 * PostgreSQL database so developers can inspect the ORQELI Education workflow,
 * public school discovery, student verification, and student portal locally.
 *
 * Refuses to execute when NODE_ENV === 'production'.
 */
import { PrismaClient } from '@prisma/client';
import { envSchema } from '../src/config.js';
import {
  formatEnrolmentCodeHint,
  hashEnrolmentCode
} from '../src/enrolmentCrypto.js';
import { hashPassword } from '../src/server.js';
import {
  SANDBOX_PERSONAS,
  SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
  SYNTHETIC_DEMO_ENROLMENT_CODE,
  SYNTHETIC_SANDBOX_CREDENTIAL
} from '../src/syntheticData.js';

const config = envSchema.parse(process.env);
if (config.NODE_ENV === 'production') {
  console.error('Refusing to seed synthetic demonstration records when NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await hashPassword(SYNTHETIC_SANDBOX_CREDENTIAL);

  const school1 = await prisma.school.upsert({
    where: { code: 'SYN-ZM-LUS-01' },
    create: {
      code: 'SYN-ZM-LUS-01',
      registrationNumber: 'SYN-REG-LUS-0101',
      name: 'Lukanga Day Secondary (Synthetic Demo)',
      sector: 'GOVERNMENT',
      province: 'Lusaka',
      district: 'Chilanga',
      levelSummary: 'Grades 8–12 Day Secondary',
      publicDescription:
        'Synthetic public secondary school profile for demonstrating teacher mark entry, approval workflow, and verified student portal access.',
      phone: '+260211000101',
      email: 'office@lukanga.synthetic.orqeli.invalid',
      isSyntheticDemo: true,
      studentPortalEnabled: true,
      status: 'PILOT_PREP'
    },
    update: {
      name: 'Lukanga Day Secondary (Synthetic Demo)',
      registrationNumber: 'SYN-REG-LUS-0101',
      levelSummary: 'Grades 8–12 Day Secondary',
      studentPortalEnabled: true,
      isSyntheticDemo: true
    }
  });

  const school2 = await prisma.school.upsert({
    where: { code: 'SYN-ZM-EAS-02' },
    create: {
      code: 'SYN-ZM-EAS-02',
      registrationNumber: 'SYN-REG-EAS-0202',
      name: 'Mpezeni Trust Academy (Synthetic Demo)',
      sector: 'PRIVATE',
      province: 'Eastern',
      district: 'Chipata',
      levelSummary: 'Grades 1–9 Primary & Junior Secondary',
      publicDescription:
        'Synthetic independent school profile in Eastern Province demonstrating strict tenant isolation across schools.',
      phone: '+260216000202',
      email: 'office@mpezeni.synthetic.orqeli.invalid',
      isSyntheticDemo: true,
      studentPortalEnabled: true,
      status: 'PILOT_PREP'
    },
    update: {
      name: 'Mpezeni Trust Academy (Synthetic Demo)',
      registrationNumber: 'SYN-REG-EAS-0202',
      studentPortalEnabled: true,
      isSyntheticDemo: true
    }
  });

  await prisma.school.upsert({
    where: { code: 'SYN-ZM-CB-03' },
    create: {
      code: 'SYN-ZM-CB-03',
      registrationNumber: 'SYN-REG-CB-0303',
      name: 'Mindolo Community Day Secondary (Synthetic Demo)',
      sector: 'COMMUNITY',
      province: 'Copperbelt',
      district: 'Kitwe',
      levelSummary: 'Grades 8–9 Community Secondary',
      publicDescription:
        'Synthetic community school listed in the public directory prior to student portal activation.',
      phone: '+260212000303',
      email: 'office@mindolo.synthetic.orqeli.invalid',
      isSyntheticDemo: true,
      studentPortalEnabled: false,
      status: 'PILOT_PREP'
    },
    update: {
      studentPortalEnabled: false,
      isSyntheticDemo: true
    }
  });

  const upsertSyntheticUser = (email: string, name: string) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, platformRole: 'STANDARD', status: 'ACTIVE' },
      update: { name, passwordHash, status: 'ACTIVE' }
    });

  const [
    headMulenga,
    deputyZulu,
    teacherBanda,
    teacherMwamba,
    guardianPhiri,
    headTembo,
    studentLubasi,
    studentPending
  ] = await Promise.all([
    upsertSyntheticUser('head.mulenga@synthetic.orqeli.invalid', 'Mrs. Mutale Mulenga (Synthetic)'),
    upsertSyntheticUser('deputy.zulu@synthetic.orqeli.invalid', 'Mr. Daka Zulu (Synthetic)'),
    upsertSyntheticUser('teacher.banda@synthetic.orqeli.invalid', 'Mr. Chanda Banda (Synthetic)'),
    upsertSyntheticUser('teacher.mwamba@synthetic.orqeli.invalid', 'Ms. Namwali Mwamba (Synthetic)'),
    upsertSyntheticUser('guardian.phiri@synthetic.orqeli.invalid', 'Mr. Kelvin Phiri (Synthetic)'),
    upsertSyntheticUser('head.tembo@synthetic.orqeli.invalid', 'Mr. Joseph Tembo (Synthetic)'),
    upsertSyntheticUser('student.lubasi@synthetic.orqeli.invalid', 'Lubasi Phiri'),
    upsertSyntheticUser('student.pending@synthetic.orqeli.invalid', 'Bupe Kasonde')
  ]);

  const upsertMembership = (
    schoolId: string,
    userId: string,
    role: 'HEAD_TEACHER' | 'DEPUTY_HEAD' | 'TEACHER' | 'PARENT_GUARDIAN' | 'STUDENT',
    status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    staffCode?: string
  ) =>
    prisma.schoolMembership.upsert({
      where: { schoolId_userId_role: { schoolId, userId, role } },
      create: { schoolId, userId, role, status, staffCode: staffCode ?? null },
      update: { status, staffCode: staffCode ?? null }
    });

  const [
    memHead1,
    ,
    memBanda,
    memMwamba,
    memGuardian,
    ,
    memStudentLubasi,
    memStudentPending
  ] = await Promise.all([
    upsertMembership(school1.id, headMulenga.id, 'HEAD_TEACHER', 'ACTIVE', 'SYN-STF-001'),
    upsertMembership(school1.id, deputyZulu.id, 'DEPUTY_HEAD', 'ACTIVE', 'SYN-STF-002'),
    upsertMembership(school1.id, teacherBanda.id, 'TEACHER', 'ACTIVE', 'SYN-STF-014'),
    upsertMembership(school1.id, teacherMwamba.id, 'TEACHER', 'ACTIVE', 'SYN-STF-019'),
    upsertMembership(school1.id, guardianPhiri.id, 'PARENT_GUARDIAN', 'ACTIVE'),
    upsertMembership(school2.id, headTembo.id, 'HEAD_TEACHER', 'ACTIVE', 'SYN-EAS-001'),
    upsertMembership(school1.id, studentLubasi.id, 'STUDENT', 'ACTIVE'),
    upsertMembership(school1.id, studentPending.id, 'STUDENT', 'INACTIVE')
  ]);

  const year2026 = await prisma.academicYear.upsert({
    where: { schoolId_year: { schoolId: school1.id, year: 2026 } },
    create: {
      schoolId: school1.id,
      year: 2026,
      label: '2026 Academic Year',
      isCurrent: true,
      startsOn: new Date('2026-01-12T00:00:00.000Z'),
      endsOn: new Date('2026-12-04T00:00:00.000Z')
    },
    update: { isCurrent: true }
  });

  const term2 = await prisma.academicTerm.upsert({
    where: { academicYearId_termNumber: { academicYearId: year2026.id, termNumber: 'TERM_2' } },
    create: {
      schoolId: school1.id,
      academicYearId: year2026.id,
      termNumber: 'TERM_2',
      label: 'Term 2 (2026)',
      isCurrent: false,
      startsOn: new Date('2026-05-11T00:00:00.000Z'),
      endsOn: new Date('2026-08-07T00:00:00.000Z')
    },
    update: { isCurrent: false }
  });

  const term3 = await prisma.academicTerm.upsert({
    where: { academicYearId_termNumber: { academicYearId: year2026.id, termNumber: 'TERM_3' } },
    create: {
      schoolId: school1.id,
      academicYearId: year2026.id,
      termNumber: 'TERM_3',
      label: 'Term 3 (2026)',
      isCurrent: true,
      startsOn: new Date('2026-09-07T00:00:00.000Z'),
      endsOn: new Date('2026-12-04T00:00:00.000Z')
    },
    update: { isCurrent: true }
  });

  const class9A = await prisma.schoolClass.upsert({
    where: { academicYearId_name: { academicYearId: year2026.id, name: 'Grade 9A' } },
    create: {
      schoolId: school1.id,
      academicYearId: year2026.id,
      name: 'Grade 9A',
      gradeLevel: 9,
      classTeacherMembershipId: memBanda.id
    },
    update: { classTeacherMembershipId: memBanda.id }
  });

  const class8B = await prisma.schoolClass.upsert({
    where: { academicYearId_name: { academicYearId: year2026.id, name: 'Grade 8B' } },
    create: {
      schoolId: school1.id,
      academicYearId: year2026.id,
      name: 'Grade 8B',
      gradeLevel: 8,
      classTeacherMembershipId: memMwamba.id
    },
    update: { classTeacherMembershipId: memMwamba.id }
  });

  const upsertSubject = (code: string, name: string) =>
    prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school1.id, code } },
      create: { schoolId: school1.id, code, name, isCore: true, maxMark: 100, active: true },
      update: { name, active: true }
    });

  const [subMath, subSci, subEng, subSoc] = await Promise.all([
    upsertSubject('MATH', 'Mathematics'),
    upsertSubject('ISCI', 'Integrated Science'),
    upsertSubject('ENG', 'English Language'),
    upsertSubject('SOC', 'Social Studies')
  ]);

  const upsertAlloc = (schoolClassId: string, subjectId: string, teacherMembershipId: string) =>
    prisma.classSubjectAllocation.upsert({
      where: { schoolClassId_subjectId: { schoolClassId, subjectId } },
      create: {
        schoolId: school1.id,
        schoolClassId,
        subjectId,
        teacherMembershipId
      },
      update: { teacherMembershipId }
    });

  await Promise.all([
    upsertAlloc(class9A.id, subMath.id, memBanda.id),
    upsertAlloc(class9A.id, subSci.id, memBanda.id),
    upsertAlloc(class9A.id, subEng.id, memMwamba.id),
    upsertAlloc(class9A.id, subSoc.id, memMwamba.id),
    upsertAlloc(class8B.id, subMath.id, memBanda.id),
    upsertAlloc(class8B.id, subEng.id, memMwamba.id),
    upsertAlloc(class8B.id, subSci.id, memBanda.id)
  ]);

  const upsertLearner = (
    admissionNumber: string,
    firstName: string,
    lastName: string,
    schoolClassId: string
  ) =>
    prisma.learner.upsert({
      where: { schoolId_admissionNumber: { schoolId: school1.id, admissionNumber } },
      create: {
        schoolId: school1.id,
        admissionNumber,
        firstName,
        lastName,
        schoolClassId,
        preferredChannel: 'PRINT_REPORT'
      },
      update: { schoolClassId }
    });

  const [lrnTasha, lrnMwila, lrnBupe, lrnLubasi, lrnChisomo] = await Promise.all([
    upsertLearner('SYN-2026-0901', 'Tasha', 'Phiri', class9A.id),
    upsertLearner('SYN-2026-0902', 'Mwila', 'Chibwe', class9A.id),
    upsertLearner('SYN-2026-0903', 'Bupe', 'Kasonde', class9A.id),
    upsertLearner('SYN-2026-0801', 'Lubasi', 'Phiri', class8B.id),
    upsertLearner(SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO, 'Chisomo', 'Banda', class8B.id)
  ]);

  await Promise.all([
    prisma.learnerGuardianLink.upsert({
      where: { membershipId_learnerId: { membershipId: memGuardian.id, learnerId: lrnTasha.id } },
      create: {
        schoolId: school1.id,
        membershipId: memGuardian.id,
        learnerId: lrnTasha.id,
        relationship: 'Parent / Guardian'
      },
      update: {}
    }),
    prisma.learnerGuardianLink.upsert({
      where: { membershipId_learnerId: { membershipId: memGuardian.id, learnerId: lrnLubasi.id } },
      create: {
        schoolId: school1.id,
        membershipId: memGuardian.id,
        learnerId: lrnLubasi.id,
        relationship: 'Parent / Guardian'
      },
      update: {}
    }),
    prisma.learnerStudentLink.upsert({
      where: { learnerId: lrnLubasi.id },
      create: {
        schoolId: school1.id,
        membershipId: memStudentLubasi.id,
        learnerId: lrnLubasi.id,
        verificationMethod: 'ENROLMENT_CODE',
        verifiedByMembershipId: memHead1.id
      },
      update: { membershipId: memStudentLubasi.id }
    })
  ]);

  const demoCodeHash = hashEnrolmentCode(SYNTHETIC_DEMO_ENROLMENT_CODE);
  await prisma.studentEnrolmentCode.upsert({
    where: { codeHash: demoCodeHash },
    create: {
      schoolId: school1.id,
      learnerId: lrnChisomo.id,
      codeHash: demoCodeHash,
      codeHint: formatEnrolmentCodeHint(SYNTHETIC_DEMO_ENROLMENT_CODE),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByMembershipId: memHead1.id
    },
    update: {}
  });

  const existingPendingReq = await prisma.studentRegistrationRequest.findFirst({
    where: { schoolId: school1.id, userId: studentPending.id }
  });
  if (!existingPendingReq) {
    await prisma.studentRegistrationRequest.create({
      data: {
        schoolId: school1.id,
        userId: studentPending.id,
        submittedAdmissionNumber: lrnBupe.admissionNumber,
        applicantName: 'Bupe Kasonde',
        classHint: 'Grade 9A',
        status: 'PENDING'
      }
    });
  }

  const existingAnnouncements = await prisma.schoolAnnouncement.count({
    where: { schoolId: school1.id }
  });
  if (existingAnnouncements === 0) {
    await prisma.schoolAnnouncement.createMany({
      data: [
        {
          schoolId: school1.id,
          title: 'Term 2 (2026) Official Results Published for Grade 8B',
          body: 'Approved Term 2 academic results for Grade 8B are now available in the student portal and as printable A4 statements.',
          audience: 'STUDENTS_AND_STAFF',
          publishedByMembershipId: memHead1.id
        },
        {
          schoolId: school1.id,
          title: 'Staff Mark-Sheet Deadline Reminder (Internal)',
          body: 'All subject teachers must complete pending Term 3 entries before Friday 16:00 CAT.',
          audience: 'STAFF_ONLY',
          publishedByMembershipId: memHead1.id
        }
      ]
    });
  }

  const pack9A = await prisma.termResultPack.upsert({
    where: {
      academicTermId_schoolClassId: {
        academicTermId: term3.id,
        schoolClassId: class9A.id
      }
    },
    create: {
      schoolId: school1.id,
      academicTermId: term3.id,
      schoolClassId: class9A.id,
      status: 'DRAFT'
    },
    update: {}
  });

  const pack8BT2 = await prisma.termResultPack.upsert({
    where: {
      academicTermId_schoolClassId: {
        academicTermId: term2.id,
        schoolClassId: class8B.id
      }
    },
    create: {
      schoolId: school1.id,
      academicTermId: term2.id,
      schoolClassId: class8B.id,
      status: 'PUBLISHED',
      submittedAt: new Date('2026-08-04T10:00:00.000Z'),
      submittedByMembershipId: memMwamba.id,
      approvedAt: new Date('2026-08-05T15:30:00.000Z'),
      approvedByMembershipId: memHead1.id,
      publishedAt: new Date('2026-08-06T14:00:00.000Z'),
      publishedByMembershipId: memHead1.id
    },
    update: {}
  });

  const pack8BT3 = await prisma.termResultPack.upsert({
    where: {
      academicTermId_schoolClassId: {
        academicTermId: term3.id,
        schoolClassId: class8B.id
      }
    },
    create: {
      schoolId: school1.id,
      academicTermId: term3.id,
      schoolClassId: class8B.id,
      status: 'DRAFT'
    },
    update: {}
  });

  const seedMark = (
    packId: string,
    learnerId: string,
    subjectId: string,
    score: number,
    by: string,
    comment?: string
  ) =>
    prisma.subjectMark.upsert({
      where: {
        termResultPackId_learnerId_subjectId: {
          termResultPackId: packId,
          learnerId,
          subjectId
        }
      },
      create: {
        schoolId: school1.id,
        termResultPackId: packId,
        learnerId,
        subjectId,
        status: 'PRESENT',
        score,
        teacherComment: comment ?? null,
        enteredByMembershipId: by,
        enteredAt: new Date()
      },
      update: {}
    });

  await Promise.all([
    seedMark(pack9A.id, lrnTasha.id, subMath.id, 78, memBanda.id),
    seedMark(pack9A.id, lrnTasha.id, subSci.id, 82, memBanda.id),
    seedMark(pack9A.id, lrnTasha.id, subEng.id, 74, memMwamba.id),
    seedMark(pack9A.id, lrnTasha.id, subSoc.id, 80, memMwamba.id),
    // lrnMwila MATH intentionally left unrecorded (missing mark demonstration)
    seedMark(pack9A.id, lrnMwila.id, subSci.id, 69, memBanda.id),
    seedMark(pack9A.id, lrnMwila.id, subEng.id, 71, memMwamba.id),
    seedMark(pack9A.id, lrnMwila.id, subSoc.id, 75, memMwamba.id),
    seedMark(pack9A.id, lrnBupe.id, subMath.id, 85, memBanda.id),
    seedMark(pack9A.id, lrnBupe.id, subSci.id, 88, memBanda.id),
    seedMark(pack9A.id, lrnBupe.id, subEng.id, 79, memMwamba.id),
    seedMark(pack9A.id, lrnBupe.id, subSoc.id, 83, memMwamba.id),
    seedMark(pack8BT2.id, lrnLubasi.id, subMath.id, 81, memBanda.id, 'Confident numerical work.'),
    seedMark(pack8BT2.id, lrnLubasi.id, subEng.id, 76, memMwamba.id, 'Attentive reading and grammar.'),
    seedMark(pack8BT2.id, lrnLubasi.id, subSci.id, 84, memBanda.id, 'Strong curiosity in experiments.'),
    seedMark(pack8BT2.id, lrnChisomo.id, subMath.id, 72, memBanda.id, 'Good accuracy in linear equations.'),
    seedMark(pack8BT2.id, lrnChisomo.id, subEng.id, 79, memMwamba.id, 'Expressive composition writing.'),
    seedMark(pack8BT2.id, lrnChisomo.id, subSci.id, 68, memBanda.id, 'Solid understanding of plant biology.'),
    seedMark(pack8BT3.id, lrnLubasi.id, subMath.id, 91, memBanda.id, 'Draft Term 3 score — hidden until published.')
  ]);

  console.log('Seeded synthetic ORQELI Education accounts into local PostgreSQL:');
  for (const p of SANDBOX_PERSONAS) {
    console.log(`  - ${p.role.padEnd(16)} ${p.email} (${p.schoolCode})`);
  }
  console.log(`  Shared synthetic credential: ${SYNTHETIC_SANDBOX_CREDENTIAL}`);
  console.log(
    `  Single-use enrolment code walkthrough: ${SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO} / ${SYNTHETIC_DEMO_ENROLMENT_CODE}`
  );
} finally {
  await prisma.$disconnect();
}
