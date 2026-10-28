/**
 * Seeds clearly labelled synthetic demonstration records into a local development
 * PostgreSQL database so developers can inspect the ORQELI Education workflow locally.
 *
 * Refuses to execute when NODE_ENV === 'production'.
 */
import { PrismaClient } from '@prisma/client';
import { envSchema } from '../src/config.js';
import { hashPassword } from '../src/server.js';
import {
  SANDBOX_PERSONAS,
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
      name: 'Lukanga Day Secondary (Synthetic Demo)',
      sector: 'GOVERNMENT',
      province: 'Lusaka',
      district: 'Chilanga',
      phone: '+260211000101',
      email: 'office@lukanga.synthetic.orqeli.invalid',
      isSyntheticDemo: true,
      status: 'PILOT_PREP'
    },
    update: {
      name: 'Lukanga Day Secondary (Synthetic Demo)',
      isSyntheticDemo: true
    }
  });

  const school2 = await prisma.school.upsert({
    where: { code: 'SYN-ZM-EAS-02' },
    create: {
      code: 'SYN-ZM-EAS-02',
      name: 'Mpezeni Trust Academy (Synthetic Demo)',
      sector: 'PRIVATE',
      province: 'Eastern',
      district: 'Chipata',
      phone: '+260216000202',
      email: 'office@mpezeni.synthetic.orqeli.invalid',
      isSyntheticDemo: true,
      status: 'PILOT_PREP'
    },
    update: {
      name: 'Mpezeni Trust Academy (Synthetic Demo)',
      isSyntheticDemo: true
    }
  });

  const upsertSyntheticUser = (email: string, name: string) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, platformRole: 'STANDARD', status: 'ACTIVE' },
      update: { name, passwordHash, status: 'ACTIVE' }
    });

  const [headMulenga, deputyZulu, teacherBanda, teacherMwamba, guardianPhiri, headTembo] =
    await Promise.all([
      upsertSyntheticUser('head.mulenga@synthetic.orqeli.invalid', 'Mrs. Mutale Mulenga (Synthetic)'),
      upsertSyntheticUser('deputy.zulu@synthetic.orqeli.invalid', 'Mr. Daka Zulu (Synthetic)'),
      upsertSyntheticUser('teacher.banda@synthetic.orqeli.invalid', 'Mr. Chanda Banda (Synthetic)'),
      upsertSyntheticUser('teacher.mwamba@synthetic.orqeli.invalid', 'Ms. Namwali Mwamba (Synthetic)'),
      upsertSyntheticUser('guardian.phiri@synthetic.orqeli.invalid', 'Mr. Kelvin Phiri (Synthetic)'),
      upsertSyntheticUser('head.tembo@synthetic.orqeli.invalid', 'Mr. Joseph Tembo (Synthetic)')
    ]);

  const upsertMembership = (
    schoolId: string,
    userId: string,
    role: 'HEAD_TEACHER' | 'DEPUTY_HEAD' | 'TEACHER' | 'PARENT_GUARDIAN',
    staffCode?: string
  ) =>
    prisma.schoolMembership.upsert({
      where: { schoolId_userId_role: { schoolId, userId, role } },
      create: { schoolId, userId, role, status: 'ACTIVE', staffCode: staffCode ?? null },
      update: { status: 'ACTIVE', staffCode: staffCode ?? null }
    });

  const [memHead1, , memBanda, memMwamba, memGuardian] = await Promise.all([
    upsertMembership(school1.id, headMulenga.id, 'HEAD_TEACHER', 'SYN-STF-001'),
    upsertMembership(school1.id, deputyZulu.id, 'DEPUTY_HEAD', 'SYN-STF-002'),
    upsertMembership(school1.id, teacherBanda.id, 'TEACHER', 'SYN-STF-014'),
    upsertMembership(school1.id, teacherMwamba.id, 'TEACHER', 'SYN-STF-019'),
    upsertMembership(school1.id, guardianPhiri.id, 'PARENT_GUARDIAN'),
    upsertMembership(school2.id, headTembo.id, 'HEAD_TEACHER', 'SYN-EAS-001')
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

  const upsertAlloc = (subjectId: string, teacherMembershipId: string) =>
    prisma.classSubjectAllocation.upsert({
      where: { schoolClassId_subjectId: { schoolClassId: class9A.id, subjectId } },
      create: {
        schoolId: school1.id,
        schoolClassId: class9A.id,
        subjectId,
        teacherMembershipId
      },
      update: { teacherMembershipId }
    });

  await Promise.all([
    upsertAlloc(subMath.id, memBanda.id),
    upsertAlloc(subSci.id, memBanda.id),
    upsertAlloc(subEng.id, memMwamba.id),
    upsertAlloc(subSoc.id, memMwamba.id)
  ]);

  const lrnTasha = await prisma.learner.upsert({
    where: { schoolId_admissionNumber: { schoolId: school1.id, admissionNumber: 'SYN-2026-0901' } },
    create: {
      schoolId: school1.id,
      admissionNumber: 'SYN-2026-0901',
      firstName: 'Tasha',
      lastName: 'Phiri',
      schoolClassId: class9A.id,
      guardianName: 'Mr. Kelvin Phiri (Synthetic)',
      guardianPhone: '+260970000101',
      preferredChannel: 'PRINT_REPORT'
    },
    update: { schoolClassId: class9A.id }
  });

  const lrnMwila = await prisma.learner.upsert({
    where: { schoolId_admissionNumber: { schoolId: school1.id, admissionNumber: 'SYN-2026-0902' } },
    create: {
      schoolId: school1.id,
      admissionNumber: 'SYN-2026-0902',
      firstName: 'Mwila',
      lastName: 'Chibwe',
      schoolClassId: class9A.id,
      guardianName: 'Mrs. Grace Chibwe (Synthetic)',
      guardianPhone: '+260970000102',
      preferredChannel: 'SMS_SUMMARY'
    },
    update: { schoolClassId: class9A.id }
  });

  await prisma.learnerGuardianLink.upsert({
    where: { membershipId_learnerId: { membershipId: memGuardian.id, learnerId: lrnTasha.id } },
    create: {
      schoolId: school1.id,
      membershipId: memGuardian.id,
      learnerId: lrnTasha.id,
      relationship: 'Parent / Guardian'
    },
    update: {}
  });

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

  const seedMark = (learnerId: string, subjectId: string, score: number, by: string) =>
    prisma.subjectMark.upsert({
      where: {
        termResultPackId_learnerId_subjectId: {
          termResultPackId: pack9A.id,
          learnerId,
          subjectId
        }
      },
      create: {
        schoolId: school1.id,
        termResultPackId: pack9A.id,
        learnerId,
        subjectId,
        status: 'PRESENT',
        score,
        enteredByMembershipId: by,
        enteredAt: new Date()
      },
      update: {}
    });

  await Promise.all([
    seedMark(lrnTasha.id, subMath.id, 78, memBanda.id),
    seedMark(lrnTasha.id, subSci.id, 82, memBanda.id),
    seedMark(lrnTasha.id, subEng.id, 74, memMwamba.id),
    seedMark(lrnTasha.id, subSoc.id, 80, memMwamba.id),
    // lrnMwila MATH intentionally left unrecorded (missing mark demonstration)
    seedMark(lrnMwila.id, subSci.id, 69, memBanda.id),
    seedMark(lrnMwila.id, subEng.id, 71, memMwamba.id),
    seedMark(lrnMwila.id, subSoc.id, 75, memMwamba.id)
  ]);

  console.log('Seeded synthetic ORQELI Education accounts into local PostgreSQL:');
  for (const p of SANDBOX_PERSONAS) {
    console.log(`  - ${p.role.padEnd(16)} ${p.email} (${p.schoolCode})`);
  }
  console.log(`  Shared synthetic credential: ${SYNTHETIC_SANDBOX_CREDENTIAL}`);
  void memHead1;
} finally {
  await prisma.$disconnect();
}
